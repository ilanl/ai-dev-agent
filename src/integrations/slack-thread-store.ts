import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildThreadId } from "./run-registry.js";

export interface SlackThreadBinding {
  channelId: string;
  threadTs: string;
  issueKey: string;
  threadId: string;
  agentId: string;
  updatedAt: string;
}

const DIR = join(process.cwd(), ".agent-runs", "slack-threads");

function key(channelId: string, threadTs: string): string {
  return `${channelId}_${threadTs.replace(/\./g, "_")}`;
}

function filePath(channelId: string, threadTs: string): string {
  return join(DIR, `${key(channelId, threadTs)}.json`);
}

export async function bindSlackThread(binding: SlackThreadBinding): Promise<void> {
  await mkdir(DIR, { recursive: true });
  await writeFile(
    filePath(binding.channelId, binding.threadTs),
    JSON.stringify(binding, null, 2),
    "utf8"
  );
}

export async function loadSlackThread(
  channelId: string,
  threadTs: string
): Promise<SlackThreadBinding | null> {
  try {
    const raw = await readFile(filePath(channelId, threadTs), "utf8");
    return JSON.parse(raw) as SlackThreadBinding;
  } catch {
    return null;
  }
}

export async function unbindSlackThread(channelId: string, threadTs: string): Promise<void> {
  try {
    await unlink(filePath(channelId, threadTs));
  } catch {
    // already gone
  }
}

export function makeBinding(options: {
  channelId: string;
  threadTs: string;
  issueKey: string;
  agentId: string;
}): SlackThreadBinding {
  return {
    channelId: options.channelId,
    threadTs: options.threadTs,
    issueKey: options.issueKey.toUpperCase(),
    threadId: buildThreadId(options.agentId, options.issueKey),
    agentId: options.agentId,
    updatedAt: new Date().toISOString(),
  };
}

export async function listSlackBindings(): Promise<SlackThreadBinding[]> {
  try {
    const files = await readdir(DIR);
    const bindings: SlackThreadBinding[] = [];
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      try {
        const raw = await readFile(join(DIR, file), "utf8");
        bindings.push(JSON.parse(raw) as SlackThreadBinding);
      } catch {
        // skip
      }
    }
    return bindings.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}
