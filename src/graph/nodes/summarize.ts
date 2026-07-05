import type { AgentStateType } from "../state.js";

export async function summarize(state: AgentStateType): Promise<Partial<AgentStateType>> {
  const lintOk = state.lintResult?.ok ?? false;
  const testOk = state.testResult?.ok ?? false;
  const e2eOk = state.e2eResult ? state.e2eResult.ok : null;

  const finalStatus =
    state.status === "rejected"
      ? "rejected"
      : state.cli.dryRun && state.planApproved
        ? "shipped"
        : lintOk && testOk && (e2eOk === null || e2eOk)
          ? state.mrUrls.length > 0
            ? "shipped"
            : state.planApproved && state.branchName
              ? "failed"
              : "shipped"
          : "failed";

  console.log("\n=== RUN SUMMARY ===\n");
  console.log(`Ticket:     ${state.jiraIssueKey}`);
  console.log(`Status:     ${finalStatus}`);
  console.log(`Scope:      ${state.scope}`);
  console.log(`Branch:     ${state.branchName}`);
  console.log(`Repo:       ${state.activeRepoPath}`);
  console.log(`Codex runs: ${state.codexAttempts}/${state.cli.maxAttempts}`);
  console.log(`Lint:       ${lintOk ? "PASS" : "FAIL"}`);
  console.log(`Tests:      ${testOk ? "PASS" : "FAIL"}`);
  if (e2eOk !== null) {
    console.log(`E2E:        ${e2eOk ? "PASS" : "FAIL"}`);
  }

  if (state.mrUrls.length) {
    console.log(`MR:         ${state.mrUrls.join(", ")}`);
  }

  if (state.filesChanged.length) {
    console.log(`\nFiles changed (${state.filesChanged.length}):`);
    for (const f of state.filesChanged) {
      console.log(`  - ${f}`);
    }
  }

  if (state.openRisks.length) {
    console.log("\nOpen risks:");
    for (const risk of state.openRisks) {
      console.log(`  - ${risk}`);
    }
  }

  if (state.error) {
    console.log(`\nError: ${state.error}`);
  }

  return { status: finalStatus };
}
