import { readdir, readFile, writeFile, mkdir, unlink, rm } from "node:fs/promises";
import { join } from "node:path";
import type { CliArgs } from "../config/cli-args.js";

export interface RunMeta {
  threadId: string;
  agentId: string;
  issueKey: string;
  clientPath: string;
  serverPath: string;
  scope?: CliArgs["scope"];
  updatedAt: string;
  cli: Pick<
    CliArgs,
    "dryRun" | "verbose" | "fullSkills" | "maxAttempts" | "lint" | "test" | "e2e"
  >;
}

const THREADS_DIR = join(process.cwd(), ".agent-runs", "threads");

export function buildThreadId(agentId: string, issueKey: string): string {
  return `${agentId}:${issueKey.toUpperCase()}`;
}

export function parseThreadId(threadId: string): { agentId: string; issueKey: string } {
  const idx = threadId.indexOf(":");
  if (idx <= 0) {
    throw new Error(`Invalid thread id: ${threadId}`);
  }
  return {
    agentId: threadId.slice(0, idx),
    issueKey: threadId.slice(idx + 1),
  };
}

function metaPath(threadId: string): string {
  return join(THREADS_DIR, `${threadId}.json`);
}

export async function saveRunMeta(meta: RunMeta): Promise<void> {
  await mkdir(THREADS_DIR, { recursive: true });
  await writeFile(metaPath(meta.threadId), JSON.stringify(meta, null, 2), "utf8");
}

export async function loadRunMeta(threadId: string): Promise<RunMeta | null> {
  try {
    const raw = await readFile(metaPath(threadId), "utf8");
    return JSON.parse(raw) as RunMeta;
  } catch {
    return null;
  }
}

export async function listRunMeta(agentId?: string): Promise<RunMeta[]> {
  try {
    const files = await readdir(THREADS_DIR);
    const metas: RunMeta[] = [];
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      try {
        const raw = await readFile(join(THREADS_DIR, file), "utf8");
        const meta = JSON.parse(raw) as RunMeta;
        if (!agentId || meta.agentId === agentId) {
          metas.push(meta);
        }
      } catch {
        // skip corrupt entries
      }
    }
    return metas.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

export function runArtifactsDir(threadId: string): string {
  return join(process.cwd(), ".agent-runs", threadId);
}

export async function deleteRunMeta(threadId: string): Promise<boolean> {
  try {
    await unlink(metaPath(threadId));
    return true;
  } catch {
    return false;
  }
}

export async function deleteRunArtifacts(threadId: string): Promise<void> {
  await rm(runArtifactsDir(threadId), { recursive: true, force: true });
}
