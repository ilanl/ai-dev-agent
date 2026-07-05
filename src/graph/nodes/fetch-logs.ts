import type { AgentStateType } from "../state.js";
import { logNodeDone, logNodeStart } from "../../integrations/agent-log.js";

export async function fetchLogs(state: AgentStateType): Promise<Partial<AgentStateType>> {
  logNodeStart("fetchLogs", { threadId: state.threadId });
  // Phase 1: pass Coralogix URLs from Jira; full MCP fetch deferred to Phase 3.
  logNodeDone("fetchLogs", { threadId: state.threadId });
  return {};
}
