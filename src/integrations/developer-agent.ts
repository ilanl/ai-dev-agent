import { loadDeveloperRuntime } from "../config/developer-runtime.js";
import { runCodex, type CodexRunOptions, type CodexRunResult } from "./codex.js";
import { runCursorAgent } from "./cursor-agent.js";

export type DeveloperRunOptions = CodexRunOptions;
export type DeveloperRunResult = CodexRunResult;

export async function runDeveloperAgent(
  options: DeveloperRunOptions
): Promise<DeveloperRunResult> {
  const { runtime } = loadDeveloperRuntime();
  if (runtime === "codex") {
    return runCodex(options);
  }
  return runCursorAgent(options);
}
