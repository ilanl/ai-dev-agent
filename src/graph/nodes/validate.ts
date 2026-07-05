import { execa } from "execa";
import { isVerbose } from "../../config/verbosity.js";
import { logNodeDone, logNodeStart } from "../../integrations/agent-log.js";
import { wrapCommandWithNvm } from "../../integrations/repo-node.js";
import type { AgentStateType, ValidationResult } from "../state.js";

async function runCommand(
  repoPath: string,
  command: string,
  label: string,
  nodeVersion: string | undefined
): Promise<ValidationResult> {
  const wrapped = wrapCommandWithNvm(command, nodeVersion);
  const verbose = isVerbose();

  if (verbose) {
    console.log(`\n=== Running ${label}: ${command} ===\n`);
  }

  const result = await execa("bash", ["-lc", wrapped], {
    cwd: repoPath,
    reject: false,
    env: process.env,
    stdout: "pipe",
    stderr: "pipe",
  });

  const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
  const ok = result.exitCode === 0;

  if (verbose) {
    console.log(`${label}: ${ok ? "pass" : "FAIL"}`);
    if (output) console.log(output);
  } else if (!ok && output) {
    console.error(`${label}: FAIL\n${output}`);
  }

  return {
    ok,
    output: output || `Exit code ${result.exitCode}`,
  };
}

export async function validate(state: AgentStateType): Promise<Partial<AgentStateType>> {
  logNodeStart("validate", { threadId: state.threadId, attempt: state.codexAttempts });
  const nodeVersion = state.nodeVersion;
  const lintResult = await runCommand(
    state.activeRepoPath,
    state.lintCommand,
    "lint",
    nodeVersion
  );
  const testResult = lintResult.ok
    ? await runCommand(state.activeRepoPath, state.testCommand, "tests", nodeVersion)
    : { ok: false, output: "Skipped tests because lint failed." };

  let e2eResult = null;
  if (lintResult.ok && testResult.ok && state.e2eCommand) {
    e2eResult = await runCommand(
      state.activeRepoPath,
      state.e2eCommand,
      "e2e",
      nodeVersion
    );
  }

  logNodeDone("validate", {
    threadId: state.threadId,
    lint: lintResult.ok ? "pass" : "fail",
    test: testResult.ok ? "pass" : "fail",
    ...(e2eResult ? { e2e: e2eResult.ok ? "pass" : "fail" } : {}),
  });

  return {
    lintResult,
    testResult,
    e2eResult,
  };
}

function allValidationPassed(state: AgentStateType): boolean {
  if (!state.lintResult?.ok || !state.testResult?.ok) return false;
  if (state.e2eCommand && state.e2eResult && !state.e2eResult.ok) return false;
  return true;
}

function formatValidationFailures(state: AgentStateType): string {
  const parts: string[] = [];

  if (state.lintResult && !state.lintResult.ok) {
    parts.push("Lint failed:\n```\n" + state.lintResult.output + "\n```");
  }
  if (state.testResult && !state.testResult.ok) {
    parts.push("Tests failed:\n```\n" + state.testResult.output + "\n```");
  }
  if (state.e2eResult && !state.e2eResult.ok) {
    parts.push("E2E failed:\n```\n" + state.e2eResult.output + "\n```");
  }

  parts.push("Fix the failures and re-run. Do not change unrelated files.");
  return parts.join("\n\n");
}

export function routeAfterValidate(state: AgentStateType): string {
  if (allValidationPassed(state)) {
    return "shipApproval";
  }

  if (state.codexAttempts >= state.cli.maxAttempts) {
    return "summarize";
  }

  return "retryCodex";
}

export function buildRetryFeedback(state: AgentStateType): Partial<AgentStateType> {
  return {
    retryFeedback: formatValidationFailures(state),
    status: "running",
  };
}
