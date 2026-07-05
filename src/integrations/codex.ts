import { execa } from "execa";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isDaemonMode } from "../config/daemon-context.js";
import { isVerbose, writeVerbose } from "../config/verbosity.js";

export type CodexSandbox = "read-only" | "workspace-write";

export interface CodexRunOptions {
  repoPath: string;
  prompt: string;
  sessionId?: string;
  sandbox?: CodexSandbox;
  /** Extra directories Codex may read (e.g. project `.cursor/skills`) */
  extraReadDirs?: string[];
}

export interface CodexRunResult {
  output: string;
  blocked: boolean;
  ok: boolean;
  exitCode: number;
  stderr: string;
  blockedQuestion?: string;
  sessionId?: string;
}

const BLOCKED_RE = /BLOCKED:\s*(.+)/i;

export async function runCodex(options: CodexRunOptions): Promise<CodexRunResult> {
  const sandbox = options.sandbox ?? "workspace-write";
  const verbose = isVerbose();

  const args = [
    "exec",
    "-s",
    sandbox,
    "-C",
    options.repoPath,
    "--color",
    "never",
    "--dangerously-bypass-approvals-and-sandbox",
  ];

  let quietOutputFile: string | undefined;
  let quietTempDir: string | undefined;

  if (verbose) {
    args.push("--json");
  } else {
    quietTempDir = await mkdtemp(join(tmpdir(), "codex-quiet-"));
    quietOutputFile = join(quietTempDir, "last-message.md");
    args.push("-o", quietOutputFile);
  }

  for (const dir of options.extraReadDirs ?? []) {
    args.push("--add-dir", dir);
  }

  const child = execa("codex", args, {
    input: options.prompt,
    reject: false,
    env: {
      ...process.env,
      CI: "1",
      NO_COLOR: "1",
    },
    stdout: verbose ? "pipe" : "ignore",
    stderr: "pipe",
  });

  if (verbose) {
    child.stdout?.on("data", (chunk: Buffer) => writeVerbose(process.stdout, chunk));
    child.stderr?.on("data", (chunk: Buffer) => writeVerbose(process.stderr, chunk));
  }

  const { stdout, stderr, exitCode: rawExitCode } = await child;
  const exitCode = rawExitCode ?? 1;
  const stderrText = (stderr ?? "").trim();

  let combined = "";
  let output = "";

  if (verbose) {
    combined = [stdout, stderr].filter(Boolean).join("\n");
    output = extractFinalMessage(combined);
  } else if (quietOutputFile) {
    try {
      output = (await readFile(quietOutputFile, "utf8")).trim();
    } catch {
      output = "";
    }
    if (quietTempDir) {
      await rm(quietTempDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  const sessionId = verbose ? extractSessionId(combined) : undefined;

  const blockedMatch = output.match(BLOCKED_RE);
  if (blockedMatch?.[1]) {
    const blocked: CodexRunResult = {
      output,
      blocked: true,
      ok: true,
      exitCode,
      stderr: stderrText,
      blockedQuestion: blockedMatch[1].trim(),
    };
    if (sessionId) blocked.sessionId = sessionId;
    return blocked;
  }

  if (exitCode !== 0) {
    const detail = formatCodexFailure(exitCode, output, combined, stderrText);
    if (!isDaemonMode()) {
      console.error(`\nCodex failed:\n${detail}\n`);
    }
    const failed: CodexRunResult = {
      output: detail,
      blocked: false,
      ok: false,
      exitCode,
      stderr: stderrText,
    };
    if (sessionId) failed.sessionId = sessionId;
    return failed;
  }

  const success: CodexRunResult = {
    output: output || combined,
    blocked: false,
    ok: true,
    exitCode,
    stderr: stderrText,
  };
  if (sessionId) success.sessionId = sessionId;
  return success;
}

function formatCodexFailure(
  exitCode: number,
  output: string,
  combined: string,
  stderr: string
): string {
  const jsonlError = extractCodexError(combined);
  if (jsonlError) return jsonlError;

  const parts: string[] = [];
  if (stderr) parts.push(stderr);
  if (output.trim()) parts.push(output.trim());
  if (parts.length > 0) return parts.join("\n\n");

  return `Codex exited with code ${exitCode}`;
}

function extractCodexError(output: string): string | undefined {
  let lastError: string | undefined;
  for (const line of output.split("\n")) {
    try {
      const event = JSON.parse(line) as {
        type?: string;
        message?: string;
        error?: { message?: string };
      };
      if (event.type === "error" && event.message?.trim()) {
        lastError = event.message.trim();
      }
      if (event.type === "turn.failed" && event.error?.message?.trim()) {
        lastError = event.error.message.trim();
      }
    } catch {
      // not jsonl
    }
  }
  return lastError;
}

/** Persist plan for review without dumping to the terminal */
export async function writePlanArtifact(threadId: string, plan: string): Promise<string> {
  const dir = join(process.cwd(), ".agent-runs", threadId);
  await mkdir(dir, { recursive: true });
  const path = join(dir, "plan.md");
  await writeFile(path, plan, "utf8");
  return path;
}

function extractSessionId(output: string): string | undefined {
  for (const line of output.split("\n")) {
    try {
      const event = JSON.parse(line) as {
        type?: string;
        session_id?: string;
        thread_id?: string;
      };
      if (event.session_id) return event.session_id;
      if (event.thread_id) return event.thread_id;
    } catch {
      // not jsonl
    }
  }
  return undefined;
}

function extractFinalMessage(output: string): string {
  const messages: string[] = [];

  for (const line of output.split("\n")) {
    try {
      const event = JSON.parse(line) as {
        type?: string;
        item?: { type?: string; text?: string };
        message?: string;
        content?: string;
      };

      const text =
        event.item?.text ??
        event.message ??
        event.content ??
        (event.type === "agent_message" && typeof event.item === "object"
          ? (event.item as { text?: string }).text
          : undefined);

      if (text?.trim()) {
        messages.push(text.trim());
      }
    } catch {
      // not jsonl
    }
  }

  if (messages.length > 0) {
    return messages[messages.length - 1]!;
  }

  return output
    .split("\n")
    .filter((line) => {
      try {
        JSON.parse(line);
        return false;
      } catch {
        return line.trim().length > 0;
      }
    })
    .join("\n")
    .trim();
}

export async function loadAgentsMd(repoPath: string): Promise<string> {
  try {
    return await readFile(join(repoPath, "AGENTS.md"), "utf8");
  } catch {
    return "(No AGENTS.md found in repo root. Follow existing patterns in the codebase.)";
  }
}

const SILENT_OUTPUT_RULES = [
  "- Work autonomously. Do not narrate steps or explain what you are about to do.",
  "- Do not print token counts, progress, or tool-call chatter.",
  "- Output only the final deliverable (plan, summary, or BLOCKED question). No preamble.",
];

export function buildCodexPlanPrompt(options: {
  jiraText: string;
  coralogixContext: string;
  repoPath: string;
  baseBranch: string;
  branchName: string;
  scope: string;
  clientPath: string;
  serverPath: string;
  codingRules: string;
  skillsContext: string;
  nodeVersion?: string;
  lintCommand: string;
  testCommand: string;
  e2eCommand?: string;
  humanAnswers?: Array<{ question: string; answer: string }>;
  planFeedback?: string;
}): string {
  const sections = [
    "# Role",
    "You are a senior developer investigating a Jira ticket and drafting an implementation plan.",
    "",
    "# Rules",
    "- READ and explore the repository to find code relevant to this ticket.",
    "- Follow skills from the **active repo** (`.cursor/skills/`) and **agent skills** (this project's `.cursor/skills/`). Read skill files on disk; lean mode does not inline bodies.",
    "- Use AGENTS.md when present.",
    ...SILENT_OUTPUT_RULES,
    "- Do NOT edit any files. Do NOT create branches. Do NOT commit.",
    "- Do NOT run git commit, git push, or open merge requests.",
    "- If requirements are unclear after reading the code, output exactly: BLOCKED: <your concise question>",
    "",
    "# Jira ticket",
    options.jiraText,
  ];

  if (options.coralogixContext) {
    sections.push("", "# Log / trace context", options.coralogixContext);
  }

  sections.push(
    "",
    "# Repository context",
    `Scope: ${options.scope}`,
    `Client path: ${options.clientPath}`,
    `Server path: ${options.serverPath}`,
    `Active repo (scan this): ${options.repoPath}`,
    `Current base branch: ${options.baseBranch}`,
    `Planned ticket branch: ${options.branchName}`,
    ...(options.nodeVersion
      ? ["", "# Node version", `Use Node ${options.nodeVersion} from .nvmrc (run nvm use before pnpm/node commands).`]
      : []),
    "",
    options.skillsContext,
    "",
    "# AGENTS.md",
    options.codingRules,
    "",
    "# Validation commands (for test plan section)",
    `Lint: ${options.lintCommand}`,
    `Tests: ${options.testCommand}`
  );

  if (options.e2eCommand) {
    sections.push(`E2E: ${options.e2eCommand}`);
  }

  if (options.humanAnswers?.length) {
    sections.push("", "# Human answers to prior questions");
    for (const qa of options.humanAnswers) {
      sections.push(`Q: ${qa.question}`, `A: ${qa.answer}`, "");
    }
  }

  if (options.planFeedback) {
    sections.push(
      "",
      "# Plan revision feedback",
      "Revise the plan to address this feedback:",
      options.planFeedback
    );
  }

  sections.push(
    "",
    "# Task",
    "Scan the codebase areas relevant to this ticket, then return a plan with:",
    "1. Root cause hypothesis (based on code + ticket)",
    "2. Specific files and symbols to change",
    "3. Step-by-step implementation plan",
    "4. Test plan",
    "5. Risks and open questions",
    "",
    "Do not write code patches. Output the plan as markdown."
  );

  return sections.join("\n");
}

export function buildCodexPrompt(options: {
  jiraText: string;
  implementationPlan: string;
  coralogixContext: string;
  repoPath: string;
  baseBranch: string;
  branchName: string;
  codingRules: string;
  skillsContext: string;
  nodeVersion?: string;
  lintCommand: string;
  testCommand: string;
  e2eCommand?: string;
  retryFeedback?: string;
  humanAnswers?: Array<{ question: string; answer: string }>;
}): string {
  const sections = [
    "# Role",
    "You are the implementation developer. Implement the fix in the repository.",
    "",
    "# Rules",
    ...SILENT_OUTPUT_RULES,
    "- Follow skills from the **active repo** (`.cursor/skills/`) and **agent skills** (this project's `.cursor/skills/`). Read skill files on disk; lean mode does not inline bodies.",
    "- Make minimal, focused changes.",
    "- Do NOT run git commit, git push, or open merge requests.",
    "- Run lint and tests locally to verify your work.",
    "- If requirements are unclear, stop and output exactly: BLOCKED: <your concise question>",
    "",
    "# Jira ticket",
    options.jiraText,
    "",
    "# Approved implementation plan",
    options.implementationPlan,
  ];

  if (options.coralogixContext) {
    sections.push("", "# Log / trace context", options.coralogixContext);
  }

  sections.push(
    "",
    "# Repository",
    `Path: ${options.repoPath}`,
    `Base branch: ${options.baseBranch}`,
    `Working branch: ${options.branchName}`,
    ...(options.nodeVersion
      ? ["", "# Node version", `Use Node ${options.nodeVersion} from .nvmrc (run nvm use before pnpm/node commands).`]
      : []),
    "",
    options.skillsContext,
    "",
    "# AGENTS.md",
    options.codingRules,
    "",
    "# Validation commands (orchestrator will re-run after you finish)",
    `Lint: ${options.lintCommand}`,
    `Tests: ${options.testCommand}`
  );

  if (options.e2eCommand) {
    sections.push(`E2E (if relevant): ${options.e2eCommand}`);
  }

  if (options.humanAnswers?.length) {
    sections.push("", "# Human answers to prior questions");
    for (const qa of options.humanAnswers) {
      sections.push(`Q: ${qa.question}`, `A: ${qa.answer}`, "");
    }
  }

  if (options.retryFeedback) {
    sections.push("", "# Fix validation failures", options.retryFeedback);
  }

  sections.push(
    "",
    "# Task",
    "Implement the approved plan. Edit source files as needed. When done, summarize what you changed in a short paragraph only."
  );

  return sections.join("\n");
}

export function extractRisksFromPlan(plan: string): string[] {
  const match = plan.match(/(?:risks?|open questions?).*?:([\s\S]*?)(?:\n#{1,3}\s|\n\d+\.\s|$)/i);
  if (!match?.[1]) return [];
  return match[1]
    .split("\n")
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);
}
