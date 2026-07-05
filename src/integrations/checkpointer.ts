import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { SqliteSaver } from "@langchain/langgraph-checkpoint-sqlite";

let saver: SqliteSaver | null = null;

export async function getCheckpointer(): Promise<SqliteSaver> {
  if (!saver) {
    const dir = join(process.cwd(), ".agent-runs");
    await mkdir(dir, { recursive: true });
    saver = SqliteSaver.fromConnString(join(dir, "checkpoints.db"));
  }
  return saver;
}
