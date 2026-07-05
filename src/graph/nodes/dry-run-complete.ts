import type { AgentStateType } from "../state.js";

export async function dryRunComplete(_state: AgentStateType): Promise<Partial<AgentStateType>> {
  console.log("\nDry run complete. Plan approved — no branch or implementation changes were made.");
  return { status: "shipped" };
}
