import { logNodeDone, logNodeStart } from "../../integrations/agent-log.js";
import type { AgentStateType } from "../state.js";

const SKIPPED = "Skipped (SKIP_VALIDATE=1)";

export async function skipValidateNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
  logNodeStart("skipValidate", { threadId: state.threadId });
  logNodeDone("skipValidate", { threadId: state.threadId, lint: "skip", test: "skip" });

  return {
    lintResult: { ok: true, output: SKIPPED },
    testResult: { ok: true, output: SKIPPED },
    e2eResult: null,
  };
}
