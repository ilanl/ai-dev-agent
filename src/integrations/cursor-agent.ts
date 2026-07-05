import { execa } from "execa";
import { isDaemonMode } from "../config/daemon-context.js";
import { loadDeveloperRuntime } from "../config/developer-runtime.js";
import { isVerbose, writeVerbose } from "../config/verbosity.js";
import type { CodexRunOptions, CodexRunResult } from "./codex.js";

const BLOCKED_RE = /BLOCKED:\s*(.+)/i;

interface CursorResultEvent {
  type?: string;
  subtype?: string;
  is_error?: boolean;
  result?: string;
  session_id?: string;
  message?: string;
  error?: { message?: string };
}

export async function runCursorAgent(options: CodexRunOptions): Promise<CodexRunResult> {
  const { cursorAgentBin, cursorModel } = loadDeveloperRuntime();
  const verbose = isVerbose();
  const sandbox = options.sandbox ?? "workspace-write";

  const args = [
    "-p",
    "--trust",
    "--workspace",
    options.repoPath,
    "--output-format",
    "stream-json",
    "--stream-partial-output",
  ];

  if (sandbox === "read-only") {
    args.push("--plan");
  } else {
    args.push("--force");
  }

  if (cursorModel) {
    args.push("--model", cursorModel);
  }

  if (options.sessionId) {
    args.push("--resume", options.sessionId);
  }

  for (const dir of options.extraReadDirs ?? []) {
    args.push("--add-dir", dir);
  }

  args.push(options.prompt);

  const child = execa(cursorAgentBin, args, {
    reject: false,
    env: {
      ...process.env,
      CI: "1",
      NO_COLOR: "1",
    },
    stdout: "pipe",
    stderr: "pipe",
  });

  if (verbose) {
    child.stdout?.on("data", (chunk: Buffer) => writeVerbose(process.stdout, chunk));
    child.stderr?.on("data", (chunk: Buffer) => writeVerbose(process.stderr, chunk));
  }

  const { stdout, stderr, exitCode: rawExitCode } = await child;
  const exitCode = rawExitCode ?? 1;
  const stderrText = (stderr ?? "").trim();
  const combined = [stdout, stderr].filter(Boolean).join("\n");

  const parsed = parseCursorOutput(combined);
  const output = parsed.output;
  const sessionId = parsed.sessionId ?? options.sessionId;

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

  const failed =
    parsed.isError ||
    exitCode !== 0 ||
    parsed.emptySuccess ||
    !output.trim() ||
    isCursorResultEnvelope(output);

  if (failed) {
    const detail = formatCursorFailure(
      exitCode,
      output,
      combined,
      stderrText,
      parsed.errorMessage ??
        (parsed.emptySuccess || !output.trim()
          ? "Cursor Agent finished without text output (empty result). Retry or use -v."
          : isCursorResultEnvelope(output)
            ? "Cursor Agent returned a JSON envelope instead of plan text."
            : undefined)
    );
    if (!isDaemonMode()) {
      console.error(`\nCursor Agent failed:\n${detail}\n`);
    }
    const result: CodexRunResult = {
      output: detail,
      blocked: false,
      ok: false,
      exitCode: exitCode || 1,
      stderr: stderrText,
    };
    if (sessionId) result.sessionId = sessionId;
    return result;
  }

  const success: CodexRunResult = {
    output,
    blocked: false,
    ok: true,
    exitCode,
    stderr: stderrText,
  };
  if (sessionId) success.sessionId = sessionId;
  return success;
}

function parseCursorOutput(combined: string): {
  output: string;
  sessionId?: string;
  isError: boolean;
  emptySuccess: boolean;
  errorMessage?: string;
} {
  const events = parseJsonLines(combined);
  let sessionId: string | undefined;
  let output = "";
  let assembled = "";
  let isError = false;
  let sawSuccessResult = false;
  let errorMessage: string | undefined;

  for (const event of events) {
    if (event.session_id) sessionId = event.session_id;

    if (event.type === "result") {
      if (event.is_error || event.subtype === "error") {
        isError = true;
        errorMessage = event.result?.trim() || event.message;
        continue;
      }
      if (event.subtype === "success" || event.is_error === false) {
        sawSuccessResult = true;
        if (event.result?.trim()) {
          output = event.result.trim();
        }
      }
      continue;
    }

    if (event.type === "assistant") {
      const text = extractAssistantText(event);
      if (text) assembled += text;
    }
  }

  if (!output.trim() && assembled.trim()) {
    output = assembled.trim();
  }

  return {
    output,
    ...(sessionId ? { sessionId } : {}),
    isError,
    emptySuccess: sawSuccessResult && !output.trim(),
    ...(errorMessage ? { errorMessage } : {}),
  };
}

function parseJsonLines(combined: string): CursorResultEvent[] {
  const events: CursorResultEvent[] = [];
  for (const line of combined.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) continue;
    try {
      events.push(JSON.parse(trimmed) as CursorResultEvent);
    } catch {
      // not json
    }
  }
  return events;
}

function extractAssistantText(event: CursorResultEvent): string | undefined {
  const message = event.message as
    | { content?: Array<{ type?: string; text?: string }> }
    | undefined;
  const parts =
    message?.content
      ?.filter((block) => block.type === "text" && block.text)
      .map((block) => block.text!) ?? [];
  return parts.length ? parts.join("") : undefined;
}

function isCursorResultEnvelope(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{")) return false;
  try {
    const parsed = JSON.parse(trimmed) as { type?: string };
    return parsed.type === "result";
  } catch {
    return false;
  }
}

function formatCursorFailure(
  exitCode: number,
  output: string,
  combined: string,
  stderr: string,
  parsedError?: string
): string {
  if (parsedError?.trim()) return parsedError.trim();

  const parts: string[] = [];
  if (stderr) parts.push(stderr);
  if (output.trim() && !isCursorResultEnvelope(output)) parts.push(output.trim());
  if (parts.length > 0) return parts.join("\n\n");

  const fallback = combined.trim();
  if (fallback && !isCursorResultEnvelope(fallback)) return fallback;

  return `Cursor Agent exited with code ${exitCode}`;
}
