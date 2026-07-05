import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

export interface AgentRecord {
  agentId: string;
  label?: string;
  source?: string;
  registeredAt: string;
}

const AGENTS_DIR = join(process.cwd(), ".agent-runs", "agents");

function agentPath(agentId: string): string {
  return join(AGENTS_DIR, `${agentId}.json`);
}

export async function registerAgent(record: AgentRecord): Promise<AgentRecord> {
  await mkdir(AGENTS_DIR, { recursive: true });
  await writeFile(agentPath(record.agentId), JSON.stringify(record, null, 2), "utf8");
  return record;
}

export async function ensureAgent(agentId: string, source = "auto"): Promise<AgentRecord> {
  const existing = await loadAgent(agentId);
  if (existing) return existing;
  return registerAgent({
    agentId,
    source,
    registeredAt: new Date().toISOString(),
  });
}

export async function loadAgent(agentId: string): Promise<AgentRecord | null> {
  try {
    const raw = await readFile(agentPath(agentId), "utf8");
    return JSON.parse(raw) as AgentRecord;
  } catch {
    return null;
  }
}

export async function listAgents(): Promise<AgentRecord[]> {
  try {
    const { readdir } = await import("node:fs/promises");
    const files = await readdir(AGENTS_DIR);
    const agents: AgentRecord[] = [];
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      try {
        const raw = await readFile(join(AGENTS_DIR, file), "utf8");
        agents.push(JSON.parse(raw) as AgentRecord);
      } catch {
        // skip
      }
    }
    return agents.sort((a, b) => a.agentId.localeCompare(b.agentId));
  } catch {
    return [];
  }
}
