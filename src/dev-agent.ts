import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";
import { Annotation, StateGraph, START, END } from "@langchain/langgraph";
import { execa } from "execa";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const model = new ChatOpenAI({
  model: "gpt-4.1-mini",
  temperature: 0,
});

const JIRA_COMMAND = "ticket-solver"; // change if your global skill command is different

const State = Annotation.Root({
  repoPath: Annotation<string>(),
  baseBranch: Annotation<string>(),
  branchName: Annotation<string>(),

  jiraIssueKey: Annotation<string>(),
  jiraInfo: Annotation<string>(),

  issue: Annotation<string>(),
  files: Annotation<string>(),
  investigation: Annotation<string>(),
  plan: Annotation<string>(),
  approved: Annotation<boolean>(),
});

async function loadJiraIssue(state: typeof State.State) {
  const { stdout } = await execa(JIRA_COMMAND, ["--get-jira", state.jiraIssueKey], {
    cwd: state.repoPath,
  });

  return {
    jiraInfo: stdout,
    issue: stdout,
  };
}

async function prepareRepo(state: typeof State.State) {
  await execa("git", ["fetch"], {
    cwd: state.repoPath,
    stdio: "inherit",
  });

  await execa("git", ["checkout", state.baseBranch], {
    cwd: state.repoPath,
    stdio: "inherit",
  });

  await execa("git", ["pull"], {
    cwd: state.repoPath,
    stdio: "inherit",
  });

  await execa("git", ["checkout", "-B", state.branchName], {
    cwd: state.repoPath,
    stdio: "inherit",
  });

  return {};
}

async function investigate(state: typeof State.State) {
  const { stdout } = await execa(
    "bash",
    [
      "-lc",
      `
      find . \
        -path './node_modules' -prune -o \
        -path './.git' -prune -o \
        -path './dist' -prune -o \
        -path './build' -prune -o \
        -type f \
        \\( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.json' \\) \
        | head -120
      `,
    ],
    { cwd: state.repoPath }
  );

  const res = await model.invoke(`
You are investigating a software issue in a repository.

Jira issue:
${state.jiraInfo}

Repository file list:
${stdout}

Find likely files or areas to inspect.
Do not write code yet.
Return concise investigation notes.
`);

  return {
    files: stdout,
    investigation: res.content.toString(),
  };
}

async function planFix(state: typeof State.State) {
  const res = await model.invoke(`
Create a safe implementation plan.

Jira issue:
${state.jiraInfo}

Investigation:
${state.investigation}

Return:
1. Root cause hypothesis
2. Files likely to change
3. Step-by-step fix plan
4. Test plan
5. Risks / questions for human
`);

  return {
    plan: res.content.toString(),
  };
}

async function humanApproval(state: typeof State.State) {
  console.log("\n=== JIRA ISSUE ===\n");
  console.log(state.jiraInfo);

  console.log("\n=== INVESTIGATION ===\n");
  console.log(state.investigation);

  console.log("\n=== PLAN ===\n");
  console.log(state.plan);

  const rl = createInterface({ input, output });
  const answer = await rl.question("\nApprove this plan? y/n: ");
  rl.close();

  return {
    approved: answer.trim().toLowerCase() === "y",
  };
}

function shouldContinue(state: typeof State.State) {
  return state.approved ? "approved" : "rejected";
}

async function approvedNode() {
  console.log("\nPlan approved.");
  console.log("Next step: add read/write tools, lint, tests, retry loop.");
  return {};
}

async function rejectedNode() {
  console.log("\nPlan rejected. Stopping before code changes.");
  return {};
}

const graph = new StateGraph(State)
  .addNode("loadJiraIssue", loadJiraIssue)
  .addNode("prepareRepo", prepareRepo)
  .addNode("investigate", investigate)
  .addNode("planFix", planFix)
  .addNode("humanApproval", humanApproval)
  .addNode("approvedNode", approvedNode)
  .addNode("rejectedNode", rejectedNode)
  .addEdge(START, "loadJiraIssue")
  .addEdge("loadJiraIssue", "prepareRepo")
  .addEdge("prepareRepo", "investigate")
  .addEdge("investigate", "planFix")
  .addEdge("planFix", "humanApproval")
  .addConditionalEdges("humanApproval", shouldContinue, {
    approved: "approvedNode",
    rejected: "rejectedNode",
  })
  .addEdge("approvedNode", END)
  .addEdge("rejectedNode", END)
  .compile();

await graph.invoke({
  repoPath: process.env.REPO_PATH,
  baseBranch: "ilan/test1",
  branchName: "ilan/AE-46597-test1",
  jiraIssueKey: "AE-46597",
  jiraInfo: "",
  issue: "",
});
