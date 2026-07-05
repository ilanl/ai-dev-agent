import "dotenv/config";
import { parseCliArgs } from "./config/cli-args.js";
import { resolveRepoPaths } from "./config/server-env.js";
import { setVerbose } from "./config/verbosity.js";
import { printInterrupt } from "./agent-runner.js";
import { promptAnswer } from "./integrations/human-gate.js";
import {
  formatInterruptNotice,
  formatPlanReview,
  type ReviewInterruptPayload,
} from "./integrations/human-review.js";
import { buildThreadId } from "./integrations/run-registry.js";
import {
  getRunCoordinator,
  normalizeResetResult,
  type ResetResult,
  type RunResult,
  type RunStatusResult,
} from "./run-coordinator.js";
import { tryConnectClient } from "./server/client.js";

function canResume(status: RunStatusResult): boolean {
  return !!status.interrupt || status.next.length > 0;
}

function resumePromptFor(status: RunStatusResult): string {
  switch (status.awaiting) {
    case "plan":
      return 'Your reply (feedback, or "implement" to start coding):';
    case "ship":
      return 'Ship review — reply: ship | reject | or feedback text';
    case "question":
      return "Codex is blocked — type your answer";
    default:
      return "Your reply:";
  }
}

function printPlanInterrupt(payload: ReviewInterruptPayload): void {
  console.log(formatPlanReview(payload));
}

async function interactivePlanChat(
  resume: (msg: string) => Promise<RunResult>,
  initial?: ReviewInterruptPayload
): Promise<number> {
  if (initial) printPlanInterrupt(initial);

  while (true) {
    const msg = await promptAnswer(resumePromptFor({ awaiting: "plan" } as RunStatusResult));
    const result = await resume(msg);
    if (result.interrupted && result.interrupt?.gate === "plan") {
      printPlanInterrupt(result.interrupt);
      continue;
    }
    return handleRunResult(result);
  }
}

async function resumeWithStatus(
  status: RunStatusResult,
  message: string | undefined,
  resume: (msg: string) => Promise<RunResult>
): Promise<number> {
  if (!canResume(status)) {
    printStatusResult(status);
    printResumeGuidance(status);
    return status.status === "failed" ? 1 : 0;
  }

  if (status.awaiting === "plan" && status.interrupt && !message) {
    return interactivePlanChat(resume, status.interrupt);
  }

  if (status.interrupt) {
    if (status.awaiting === "plan") printPlanInterrupt(status.interrupt);
    else console.log(formatInterruptNotice(status.interrupt));
  }

  const resolved = message ?? (await promptAnswer(resumePromptFor(status)));
  return handleRunResult(await resume(resolved));
}

function printResumeGuidance(status: RunStatusResult): void {
  if (status.interrupt) {
    if (status.awaiting === "plan") printPlanInterrupt(status.interrupt);
    else console.log(formatInterruptNotice(status.interrupt));
    return;
  }
  if (status.next.length > 0) {
    console.log(`\nRun in progress (next: ${status.next.join(", ")}).`);
    return;
  }
  console.log("\nNothing to resume. The run already finished.");
  if (status.status === "failed") {
    console.log("Fix the issue, then: npm run agent -- <AE-KEY> reset");
    console.log("Then start again: npm run agent -- <AE-KEY>");
  } else {
    console.log("Start fresh: npm run agent -- <AE-KEY> reset");
  }
}

function printList(runs: Awaited<ReturnType<ReturnType<typeof getRunCoordinator>["list"]>>): void {
  if (!runs.length) {
    console.log("No saved runs.");
    return;
  }
  console.log("\n=== AGENT RUNS ===\n");
  for (const run of runs) {
    console.log(`${run.threadId}  updated ${run.updatedAt}  ${run.issueKey}`);
  }
}

function printStatusResult(status: RunStatusResult): void {
  console.log("\n=== RUN STATUS ===\n");
  console.log(`Thread:   ${status.threadId}`);
  if (status.agentId) console.log(`Agent:    ${status.agentId}`);
  if (status.issueKey) console.log(`Ticket:   ${status.issueKey}`);
  if (status.status) console.log(`Status:   ${status.status}`);
  if (status.error) console.log(`Error:    ${status.error}`);
  console.log(`Next:     ${status.next.join(", ") || "(finished)"}`);
  if (status.planPath) console.log(`Plan:     ${status.planPath}`);
  if (status.branchName) console.log(`Branch:   ${status.branchName}`);
  if (status.activeRepoPath) console.log(`Repo:     ${status.activeRepoPath}`);
  if (status.interrupt) {
    console.log(`\nAwaiting: ${status.awaiting} review`);
    if (status.awaiting === "plan") printPlanInterrupt(status.interrupt);
    else console.log(formatInterruptNotice(status.interrupt));
  } else if (status.next.length === 0) {
    console.log("\nRun finished (no pending interrupts).");
  } else {
    console.log("\nRun in progress or awaiting resume.");
  }
}

function printResetResult(result: ResetResult): void {
  const r = normalizeResetResult(result);
  console.log(`\nReset ${r.threadId}`);
  console.log(`  checkpoint: ${r.checkpointDeleted ? "deleted" : "none"}`);
  console.log(`  meta:       ${r.metaDeleted ? "deleted" : "none"}`);
  console.log(`  artifacts:  ${r.artifactsDeleted ? "deleted" : "none"}`);
  console.log(`  worktrees:  ${r.worktreesRemoved} removed`);
  console.log(`  branches:   ${r.branchesDeleted} deleted`);
  if (r.gitCleanupErrors.length) {
    console.log(`  git errors: ${r.gitCleanupErrors.join("; ")}`);
  }
}

function handleRunResult(
  result: RunResult,
  options?: { interactivePlan?: boolean; resume?: (msg: string) => Promise<RunResult> }
): number | Promise<number> {
  if (
    result.interrupted &&
    result.interrupt?.gate === "plan" &&
    options?.interactivePlan &&
    options.resume
  ) {
    return interactivePlanChat(options.resume, result.interrupt);
  }
  if (result.interrupted && result.interrupt) {
    if (result.interrupt.gate === "plan") printPlanInterrupt(result.interrupt);
    else printInterrupt(result.interrupt);
    return 0;
  }
  if (result.phase === "failed" || result.status === "failed") {
    console.error(`\n=== RUN FAILED ===\n`);
    console.error(`Ticket:  ${result.threadId}`);
    if (result.error) console.error(`Error:   ${result.error}`);
    else console.error(`Status:  ${result.status}`);
    return 1;
  }
  return result.status === "shipped" || result.status === "rejected" ? 0 : 1;
}

async function runViaDaemon(cli: ReturnType<typeof parseCliArgs>): Promise<number> {
  const client = await tryConnectClient(cli.agentId);
  if (!client) {
    throw new Error(
      "agentd is not running. Start it with: npm run agentd\nOr use --local to run in-process."
    );
  }

  try {
    if (cli.command === "list") {
      const res = await client.request("ticket.list", { agentId: cli.agentId });
      if (!res.ok) throw new Error(res.error?.message ?? "ticket.list failed");
      printList(res.result as Awaited<ReturnType<ReturnType<typeof getRunCoordinator>["list"]>>);
      return 0;
    }

    const threadId = buildThreadId(cli.agentId, cli.issueKey);

    if (cli.command === "status") {
      const res = await client.request("ticket.status", { threadId });
      if (!res.ok) throw new Error(res.error?.message ?? "ticket.status failed");
      printStatusResult(res.result as RunStatusResult);
      return 0;
    }

    if (cli.command === "resume") {
      const statusRes = await client.request("ticket.status", { threadId });
      if (!statusRes.ok) throw new Error(statusRes.error?.message ?? "ticket.status failed");
      const status = statusRes.result as RunStatusResult;
      return resumeWithStatus(status, cli.message, async (message) => {
        const res = await client.request("ticket.resume", { threadId, message });
        if (!res.ok) throw new Error(res.error?.message ?? "ticket.resume failed");
        return res.result as RunResult;
      });
    }

    if (cli.command === "reset") {
      const res = await client.request("ticket.reset", { threadId });
      if (!res.ok && res.error?.code === "UNKNOWN_METHOD") {
        console.error("agentd is outdated — restart it: npm run agentd");
        printResetResult(await getRunCoordinator().reset(threadId));
        return 0;
      }
      if (!res.ok) throw new Error(res.error?.message ?? "ticket.reset failed");
      printResetResult(res.result as ResetResult);
      return 0;
    }

    const res = await client.request("ticket.start", {
      issueKey: cli.issueKey,
      agentId: cli.agentId,
      ...(cli.scope !== undefined ? { scope: cli.scope } : {}),
      ...(cli.clientBase !== undefined ? { clientBase: cli.clientBase } : {}),
      ...(cli.serverBase !== undefined ? { serverBase: cli.serverBase } : {}),
      dryRun: cli.dryRun,
      verbose: cli.verbose,
      fullSkills: cli.fullSkills,
      maxAttempts: cli.maxAttempts,
      ...(cli.lint !== undefined ? { lint: cli.lint } : {}),
      ...(cli.test !== undefined ? { test: cli.test } : {}),
      ...(cli.e2e !== undefined ? { e2e: cli.e2e } : {}),
    });
    if (!res.ok) throw new Error(res.error?.message ?? "ticket.start failed");
    const startResult = res.result as RunResult;
    const handled = handleRunResult(startResult, {
      interactivePlan: !cli.message,
      resume: async (message) => {
        const resumeRes = await client.request("ticket.resume", { threadId, message });
        if (!resumeRes.ok) throw new Error(resumeRes.error?.message ?? "ticket.resume failed");
        return resumeRes.result as RunResult;
      },
    });
    return typeof handled === "number" ? handled : await handled;
  } finally {
    client.disconnect();
  }
}

async function runLocal(cli: ReturnType<typeof parseCliArgs>): Promise<number> {
  setVerbose(cli.verbose);
  const coordinator = getRunCoordinator();
  const threadId = buildThreadId(cli.agentId, cli.issueKey);
  const repos = resolveRepoPaths({
    ...(cli.clientPath !== "N/A" ? { clientPath: cli.clientPath } : {}),
    ...(cli.serverPath !== "N/A" ? { serverPath: cli.serverPath } : {}),
  });

  if (cli.command === "list") {
    printList(await coordinator.list(cli.agentId));
    return 0;
  }

  if (cli.command === "status") {
    printStatusResult(await coordinator.status(threadId));
    return 0;
  }

  if (cli.command === "resume") {
    const status = await coordinator.status(threadId);
    return resumeWithStatus(status, cli.message, (message) =>
      coordinator.resume({ threadId, message })
    );
  }

  if (cli.command === "reset") {
    printResetResult(await coordinator.reset(threadId));
    return 0;
  }

  const result = await coordinator.start({
    issueKey: cli.issueKey,
    agentId: cli.agentId,
    clientPath: repos.clientPath,
    serverPath: repos.serverPath,
    ...(cli.scope !== undefined ? { scope: cli.scope } : {}),
    ...(cli.clientBase !== undefined ? { clientBase: cli.clientBase } : {}),
    ...(cli.serverBase !== undefined ? { serverBase: cli.serverBase } : {}),
    dryRun: cli.dryRun,
    verbose: cli.verbose,
    fullSkills: cli.fullSkills,
    maxAttempts: cli.maxAttempts,
    ...(cli.lint !== undefined ? { lint: cli.lint } : {}),
    ...(cli.test !== undefined ? { test: cli.test } : {}),
    ...(cli.e2e !== undefined ? { e2e: cli.e2e } : {}),
  });

  const handled = handleRunResult(result, {
    interactivePlan: !cli.message,
    resume: (message) => coordinator.resume({ threadId, message }),
  });
  return typeof handled === "number" ? handled : await handled;
}

async function main(): Promise<void> {
  const cli = parseCliArgs(process.argv.slice(2));
  const exitCode = cli.local ? await runLocal(cli) : await runViaDaemon(cli);
  process.exit(exitCode);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
