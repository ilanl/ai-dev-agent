import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";
import { Annotation, StateGraph, START, END } from "@langchain/langgraph";

const model = new ChatOpenAI({
  model: "gpt-4.1-mini",
  temperature: 0,
});

const AgentState = Annotation.Root({
  task: Annotation<string>(),
  requirements: Annotation<string>(),
  design: Annotation<string>(),
  implementation: Annotation<string>(),
  testResult: Annotation<string>(),
});

async function classifyTask(state: typeof AgentState.State) {
  const res = await model.invoke(`
You are a technical analyst.
Extract clear requirements from this task:

${state.task}
`);
  return { requirements: res.content.toString() };
}

async function designSolution(state: typeof AgentState.State) {
  const res = await model.invoke(`
Design a minimal implementation plan.

Task:
${state.task}

Requirements:
${state.requirements}
`);
  return { design: res.content.toString() };
}

async function implementStub(state: typeof AgentState.State) {
  const res = await model.invoke(`
Generate a patch-style TypeScript implementation.

Design:
${state.design}
`);
  return { implementation: res.content.toString() };
}

async function testStub(state: typeof AgentState.State) {
  const res = await model.invoke(`
Review this implementation and produce:
1. Test checklist
2. Risks
3. Ready / not ready verdict

Implementation:
${state.implementation}
`);
  return { testResult: res.content.toString() };
}

const graph = new StateGraph(AgentState)
  .addNode("classifyTask", classifyTask)
  .addNode("designSolution", designSolution)
  .addNode("implementStub", implementStub)
  .addNode("testStub", testStub)
  .addEdge(START, "classifyTask")
  .addEdge("classifyTask", "designSolution")
  .addEdge("designSolution", "implementStub")
  .addEdge("implementStub", "testStub")
  .addEdge("testStub", END)
  .compile();

const result = await graph.invoke({
  task: "Add Joi email validation that rejects invalid emails and accepts normal business emails.",
});

console.log("\n=== REQUIREMENTS ===\n");
console.log(result.requirements);

console.log("\n=== DESIGN ===\n");
console.log(result.design);

console.log("\n=== IMPLEMENTATION ===\n");
console.log(result.implementation);

console.log("\n=== TEST RESULT ===\n");
console.log(result.testResult);