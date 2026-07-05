export type DeveloperRuntime = "cursor" | "codex";

export interface DeveloperRuntimeConfig {
  runtime: DeveloperRuntime;
  cursorAgentBin: string;
  cursorModel: string | undefined;
}

export function loadDeveloperRuntime(): DeveloperRuntimeConfig {
  const raw = process.env.AGENT_RUNTIME?.trim().toLowerCase();
  const runtime: DeveloperRuntime = raw === "codex" ? "codex" : "cursor";
  const cursorAgentBin = process.env.CURSOR_AGENT_BIN?.trim() || "agent";
  const cursorModel = process.env.CURSOR_AGENT_MODEL?.trim() || undefined;
  return { runtime, cursorAgentBin, cursorModel };
}
