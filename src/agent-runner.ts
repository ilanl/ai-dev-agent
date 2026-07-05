import { Command } from "@langchain/langgraph";
import type { ReviewInterruptPayload } from "./integrations/human-review.js";
import { formatInterruptNotice } from "./integrations/human-review.js";
import type { AgentStateType } from "./graph/state.js";
import type { buildGraph } from "./graph/build-graph.js";

export type AgentGraph = ReturnType<typeof buildGraph>;

type InterruptValue = ReviewInterruptPayload | { msg?: string };

export interface RunInvokeResult {
  state: AgentStateType & { __interrupt__?: Array<{ id: string; value: InterruptValue }> };
  interrupted: boolean;
  interruptPayload?: ReviewInterruptPayload;
}

export async function invokeUntilIdle(
  graph: AgentGraph,
  input: Parameters<AgentGraph["invoke"]>[0],
  config: { configurable: { thread_id: string } }
): Promise<RunInvokeResult> {
  let state = (await graph.invoke(input, config)) as RunInvokeResult["state"];

  while (state.__interrupt__?.length) {
    const raw = state.__interrupt__[0]?.value;
    const payload = isReviewPayload(raw) ? raw : undefined;
    if (payload) {
      return { state, interrupted: true, interruptPayload: payload };
    }
    break;
  }

  return { state, interrupted: false };
}

export function printInterrupt(payload: ReviewInterruptPayload): void {
  console.log(formatInterruptNotice(payload));
}

function isReviewPayload(value: unknown): value is ReviewInterruptPayload {
  return (
    typeof value === "object" &&
    value !== null &&
    "gate" in value &&
    "title" in value &&
    "body" in value
  );
}

export async function printRunStatus(
  graph: AgentGraph,
  config: { configurable: { thread_id: string } },
  threadId: string
): Promise<void> {
  const snapshot = await graph.getState(config);
  const values = snapshot.values as AgentStateType | undefined;
  const taskInterrupt = snapshot.tasks?.find((t) => t.interrupts?.length)?.interrupts?.[0]?.value;
  const payload = isReviewPayload(taskInterrupt) ? taskInterrupt : undefined;

  console.log("\n=== RUN STATUS ===\n");
  console.log(`Thread:   ${threadId}`);
  console.log(`Agent:    ${values?.agentId ?? "(unknown)"}`);
  console.log(`Ticket:   ${values?.jiraIssueKey ?? "(unknown)"}`);
  console.log(`Status:   ${values?.status ?? "(no state)"}`);
  console.log(`Next:     ${snapshot.next.join(", ") || "(finished)"}`);

  if (values?.planPath) {
    console.log(`Plan:     ${values.planPath}`);
  }
  if (values?.branchName) {
    console.log(`Branch:   ${values.branchName}`);
  }
  if (values?.activeRepoPath) {
    console.log(`Repo:     ${values.activeRepoPath}`);
  }

  if (payload) {
    console.log(`\nAwaiting: ${payload.gate} review`);
    printInterrupt(payload);
  } else if (snapshot.next.length === 0) {
    console.log("\nRun finished (no pending interrupts).");
  } else {
    console.log("\nRun in progress or awaiting resume.");
  }
}
