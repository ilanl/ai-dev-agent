import { access, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { execa } from "execa";
import { isRepoPath } from "../config/cli-args.js";
import { resolveRepoPaths } from "../config/server-env.js";
import type { RepoScope } from "../config/repos.js";
import {
  generateBranchCandidates,
  isBranchNameTakenError,
  type BranchCandidateOptions,
} from "./branch-fallback.js";
import {
  branchNameTaken,
} from "./git.js";
import { parseThreadId, runArtifactsDir } from "./run-registry.js";

export interface AgentWorktreePaths {
  clientPath: string;
  serverPath: string;
  worktreeRoot: string;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function isGitWorktree(path: string): Promise<boolean> {
  if (!(await pathExists(path))) return false;
  const result = await execa("git", ["-C", path, "rev-parse", "--is-inside-work-tree"], {
    reject: false,
  });
  return result.exitCode === 0 && result.stdout.trim() === "true";
}

async function resolveBaseRef(mainRepo: string, baseBranch: string): Promise<string> {
  const result = await execa(
    "git",
    ["-C", mainRepo, "rev-parse", "--verify", baseBranch],
    { reject: false }
  );
  if (result.exitCode !== 0) {
    throw new Error(`Base branch/ref not found in ${mainRepo}: ${baseBranch}`);
  }
  return result.stdout.trim();
}

async function pruneStaleWorktrees(mainRepo: string): Promise<void> {
  await execa("git", ["-C", mainRepo, "worktree", "prune"], { reject: false });
}

async function ensureWorktree(mainRepo: string, worktreePath: string, baseBranch: string): Promise<void> {
  if (await isGitWorktree(worktreePath)) return;

  await pruneStaleWorktrees(mainRepo);
  await mkdir(join(worktreePath, ".."), { recursive: true });

  // Detached HEAD at base — avoids "branch already checked out" in the main clone.
  const baseRef = await resolveBaseRef(mainRepo, baseBranch);
  const addDetached = (force: boolean) =>
    execa(
      "git",
      [
        "-C",
        mainRepo,
        "worktree",
        "add",
        ...(force ? ["-f"] : []),
        "--detach",
        worktreePath,
        baseRef,
      ],
      { reject: false }
    );

  let add = await addDetached(false);

  if (add.exitCode !== 0) {
    const errText = `${add.stderr || ""}${add.stdout || ""}`;
    const stale =
      errText.includes("missing but already registered") ||
      errText.includes("already exists") ||
      errText.includes("is a missing worktree");

    if (stale) {
      await pruneStaleWorktrees(mainRepo);
      await execa("git", ["-C", mainRepo, "worktree", "remove", worktreePath, "--force"], {
        reject: false,
      });
      add = await addDetached(true);
    }
  }

  if (add.exitCode !== 0) {
    throw new Error(
      `Failed to create worktree at ${worktreePath}: ${add.stderr || add.stdout}`
    );
  }
}

async function revParse(repo: string, ref: string): Promise<string | null> {
  const result = await execa("git", ["-C", repo, "rev-parse", ref], { reject: false });
  return result.exitCode === 0 ? result.stdout.trim() : null;
}

async function currentBranchName(repo: string): Promise<string | null> {
  const result = await execa("git", ["-C", repo, "symbolic-ref", "--short", "HEAD"], {
    reject: false,
  });
  return result.exitCode === 0 ? result.stdout.trim() : null;
}

/** True when repo is detached HEAD at the same commit as baseBranch. */
export async function isDetachedAtBase(repoPath: string, baseBranch: string): Promise<boolean> {
  const head = await revParse(repoPath, "HEAD");
  const base = await revParse(repoPath, baseBranch);
  if (!head || !base || head !== base) return false;
  return (await currentBranchName(repoPath)) === null;
}

/** Reset worktree to detached HEAD at the merge base when needed. */
export async function ensureDetachedAtBase(repoPath: string, baseBranch: string): Promise<void> {
  if (await isDetachedAtBase(repoPath, baseBranch)) return;

  const baseRef = await resolveBaseRef(repoPath, baseBranch);
  const checkout = await execa("git", ["-C", repoPath, "checkout", "--detach", baseRef], {
    reject: false,
  });

  if (checkout.exitCode !== 0) {
    const msg = (checkout.stderr || checkout.stdout || "git checkout --detach failed").trim();
    throw new Error(`Failed to detach at ${baseBranch}: ${msg}`);
  }
}

export type CreateBranchResult = {
  success: boolean;
  branchName: string | null;
  error: string | null;
  preferredBranch: string;
  usedFallback: boolean;
};

export async function createBranchAtHead(
  repoPath: string,
  preferredBranch: string,
  options: BranchCandidateOptions = {},
): Promise<CreateBranchResult> {
  const candidates = generateBranchCandidates(preferredBranch, options);
  const existing = await currentBranchName(repoPath);
  let lastError: string | null = null;

  for (const candidate of candidates) {
    if (existing === candidate) {
      return {
        success: true,
        branchName: candidate,
        error: null,
        preferredBranch,
        usedFallback: candidate !== preferredBranch,
      };
    }

    if (await branchNameTaken(repoPath, candidate)) {
      continue;
    }

    const result = await execa("git", ["-C", repoPath, "checkout", "-b", candidate], {
      reject: false,
    });

    if (result.exitCode === 0) {
      return {
        success: true,
        branchName: candidate,
        error: null,
        preferredBranch,
        usedFallback: candidate !== preferredBranch,
      };
    }

    lastError = (result.stderr || result.stdout || "git checkout -b failed").trim();
    if (!isBranchNameTakenError(lastError)) {
      break;
    }
  }

  return {
    success: false,
    branchName: null,
    error: lastError ?? `No available branch name for ${preferredBranch}`,
    preferredBranch,
    usedFallback: false,
  };
}

export async function resolveAgentWorktrees(options: {
  threadId: string;
  clientPath: string;
  serverPath: string;
  scope?: RepoScope;
  clientBase?: string;
  serverBase?: string;
}): Promise<AgentWorktreePaths> {
  const worktreeRoot = join(runArtifactsDir(options.threadId), "worktrees");
  let clientPath = options.clientPath;
  let serverPath = options.serverPath;
  const scope = options.scope ?? "client";

  if (scope === "client" && isRepoPath(options.clientPath) && options.clientBase) {
    const wt = join(worktreeRoot, "client");
    await ensureWorktree(options.clientPath, wt, options.clientBase);
    clientPath = wt;
  }

  if (scope === "server" && isRepoPath(options.serverPath) && options.serverBase) {
    const wt = join(worktreeRoot, "server");
    await ensureWorktree(options.serverPath, wt, options.serverBase);
    serverPath = wt;
  }

  return { clientPath, serverPath, worktreeRoot };
}

export interface TeardownGitResult {
  worktreesRemoved: string[];
  branchesDeleted: string[];
  errors: string[];
}

async function isWorktreeRegistered(mainRepo: string, worktreePath: string): Promise<boolean> {
  const result = await execa("git", ["-C", mainRepo, "worktree", "list", "--porcelain"], {
    reject: false,
  });
  if (result.exitCode !== 0) return false;
  return result.stdout.split("\n").some((line) => line === `worktree ${worktreePath}`);
}

async function listWorktreesForThread(mainRepo: string, threadId: string): Promise<string[]> {
  const result = await execa("git", ["-C", mainRepo, "worktree", "list", "--porcelain"], {
    reject: false,
  });
  if (result.exitCode !== 0) return [];

  const paths: string[] = [];
  for (const line of result.stdout.split("\n")) {
    if (!line.startsWith("worktree ")) continue;
    const worktreePath = line.slice("worktree ".length).trim();
    if (worktreePath.includes(threadId)) {
      paths.push(worktreePath);
    }
  }
  return paths;
}

async function listBranchesForIssue(mainRepo: string, issueKey: string): Promise<string[]> {
  const result = await execa(
    "git",
    ["-C", mainRepo, "branch", "--list", `*${issueKey}*`],
    { reject: false }
  );
  if (result.exitCode !== 0) return [];

  return result.stdout
    .split("\n")
    .map((line) => line.trim().replace(/^\* /, ""))
    .filter(Boolean);
}

async function removeWorktree(mainRepo: string, worktreePath: string): Promise<boolean> {
  const removed = await execa(
    "git",
    ["-C", mainRepo, "worktree", "remove", worktreePath, "--force"],
    { reject: false }
  );
  return removed.exitCode === 0;
}

async function deleteLocalBranch(mainRepo: string, branchName: string): Promise<boolean> {
  const deleted = await execa("git", ["-C", mainRepo, "branch", "-D", branchName], {
    reject: false,
  });
  return deleted.exitCode === 0;
}

/** Remove agent worktrees and local ticket branch for a run. */
export async function teardownAgentRunGit(options: {
  threadId: string;
  scope?: RepoScope;
  branchName?: string;
  clientPath?: string;
  serverPath?: string;
}): Promise<TeardownGitResult> {
  const result: TeardownGitResult = {
    worktreesRemoved: [],
    branchesDeleted: [],
    errors: [],
  };

  const { issueKey } = parseThreadId(options.threadId);

  let clientPath = options.clientPath;
  let serverPath = options.serverPath;
  try {
    const env = resolveRepoPaths();
    if (!clientPath || !isRepoPath(clientPath)) clientPath = env.clientPath;
    if (!serverPath || !isRepoPath(serverPath)) serverPath = env.serverPath;
  } catch {
    // env paths unavailable — rely on explicit options only
  }

  const candidateRepos: Array<{ role: RepoScope; mainRepo: string }> = [];
  if (clientPath && isRepoPath(clientPath)) {
    candidateRepos.push({ role: "client", mainRepo: clientPath });
  }
  if (serverPath && isRepoPath(serverPath)) {
    candidateRepos.push({ role: "server", mainRepo: serverPath });
  }

  const repos = options.scope
    ? candidateRepos.filter((r) => r.role === options.scope)
    : candidateRepos;

  const worktreeRoot = join(runArtifactsDir(options.threadId), "worktrees");

  for (const { role, mainRepo } of repos) {
    const worktreePaths = new Set<string>([
      join(worktreeRoot, role),
      ...(await listWorktreesForThread(mainRepo, options.threadId)),
    ]);

    for (const worktreePath of worktreePaths) {
      const shouldRemove =
        (await pathExists(worktreePath)) || (await isWorktreeRegistered(mainRepo, worktreePath));
      if (!shouldRemove) continue;

      if (await removeWorktree(mainRepo, worktreePath)) {
        if (!result.worktreesRemoved.includes(worktreePath)) {
          result.worktreesRemoved.push(worktreePath);
        }
      } else {
        const err = await execa(
          "git",
          ["-C", mainRepo, "worktree", "remove", worktreePath, "--force"],
          { reject: false }
        );
        const msg = (err.stderr || err.stdout || "worktree remove failed").trim();
        if (!result.errors.includes(`${worktreePath}: ${msg}`)) {
          result.errors.push(`${worktreePath}: ${msg}`);
        }
      }
    }

    await pruneStaleWorktrees(mainRepo);

    const branchNames = new Set<string>();
    const explicitBranch = options.branchName?.trim();
    if (explicitBranch) {
      branchNames.add(explicitBranch);
    } else {
      for (const name of await listBranchesForIssue(mainRepo, issueKey)) {
        branchNames.add(name);
      }
    }

    for (const branchName of branchNames) {
      if (result.branchesDeleted.includes(branchName)) continue;
      if (await deleteLocalBranch(mainRepo, branchName)) {
        result.branchesDeleted.push(branchName);
      } else if (explicitBranch) {
        const err = await execa("git", ["-C", mainRepo, "branch", "-D", branchName], {
          reject: false,
        });
        const msg = (err.stderr || err.stdout || "branch delete failed").trim();
        result.errors.push(`branch ${branchName}: ${msg}`);
      }
    }
  }

  return result;
}
