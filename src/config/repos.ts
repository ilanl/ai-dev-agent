import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export type RepoScope = "client" | "server";

export interface RepoProfile {
  defaultPath?: string;
  lint: string;
  test: string;
  e2e?: string;
}

export interface ReposConfig {
  client: RepoProfile;
  server: RepoProfile;
}

const DEFAULT_CONFIG: ReposConfig = {
  client: {
    lint: "pnpm lint",
    test: "pnpm test:unit",
  },
  server: {
    lint: "pnpm lint",
    test: "pnpm test",
  },
};

export async function loadReposConfig(): Promise<ReposConfig> {
  const configPath = join(homedir(), ".ai-dev-agent", "repos.json");
  try {
    const raw = await readFile(configPath, "utf8");
    const parsed = JSON.parse(raw) as Partial<ReposConfig>;
    return {
      client: { ...DEFAULT_CONFIG.client, ...parsed.client },
      server: { ...DEFAULT_CONFIG.server, ...parsed.server },
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function inferScopeFromTicket(summary: string, description: string): RepoScope {
  const text = `${summary} ${description}`.toLowerCase();
  if (text.includes("client") || text.includes("acp") || text.includes("portal")) {
    return "client";
  }
  return "server";
}

export function buildCommitSubject(scope: RepoScope, slug: string, issueKey: string): string {
  const prefix = scope === "client" ? "fix(client)" : "fix(server)";
  return `${prefix}: ${slug} [${issueKey}]`;
}

export function slugFromBranch(branchName: string, issueKey: string): string {
  const suffix = branchName.split("/").pop() ?? branchName;
  const withoutKey = suffix.replace(new RegExp(`^${issueKey}-`, "i"), "");
  return withoutKey || "fix";
}
