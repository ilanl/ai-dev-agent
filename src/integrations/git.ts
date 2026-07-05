import { execa } from "execa";

export async function getCurrentBranch(repoPath: string): Promise<string> {
  const { stdout } = await execa("git", ["-C", repoPath, "rev-parse", "--abbrev-ref", "HEAD"]);
  return stdout.trim();
}

export async function getChangedFiles(repoPath: string): Promise<string[]> {
  const { stdout } = await execa("git", ["-C", repoPath, "diff", "--name-only", "HEAD"]);
  const unstaged = await execa("git", ["-C", repoPath, "diff", "--name-only"]);
  const untracked = await execa("git", ["-C", repoPath, "ls-files", "--others", "--exclude-standard"]);

  const files = new Set<string>();
  for (const line of [stdout, unstaged.stdout, untracked.stdout].join("\n").split("\n")) {
    const trimmed = line.trim();
    if (trimmed) files.add(trimmed);
  }
  return [...files];
}

export async function hasChanges(repoPath: string): Promise<boolean> {
  const files = await getChangedFiles(repoPath);
  return files.length > 0;
}

export async function commitAndPush(options: {
  repoPath: string;
  branchName: string;
  subject: string;
  files?: string[];
}): Promise<void> {
  if (options.files?.length) {
    await execa("git", ["-C", options.repoPath, "add", "--", ...options.files], {
      stdio: "inherit",
    });
  } else {
    await execa("git", ["-C", options.repoPath, "add", "-A"], { stdio: "inherit" });
  }

  await execa("git", ["-C", options.repoPath, "commit", "-m", options.subject], {
    stdio: "inherit",
  });

  await execa(
    "git",
    ["-C", options.repoPath, "push", "-u", "origin", options.branchName],
    { stdio: "inherit" }
  );
}

/** GitLab project path (e.g. agora.re/app/development) from origin remote URL. */
export function parseGitLabProjectPathFromRemote(url: string): string | null {
  const trimmed = url.trim();

  // git@gitlab.com:group/subgroup/repo.git
  const sshMatch = trimmed.match(/^[^@]+@[^:]+:(.+?)(?:\.git)?$/);
  if (sshMatch?.[1]) return sshMatch[1];

  // https://gitlab.com/group/subgroup/repo.git
  const httpsMatch = trimmed.match(/gitlab\.com\/(.+?)(?:\.git)?\/?$/i);
  if (httpsMatch?.[1]) return httpsMatch[1];

  return null;
}

export async function branchExistsOnRemote(
  repoPath: string,
  branchName: string
): Promise<boolean> {
  const result = await execa(
    "git",
    ["-C", repoPath, "ls-remote", "--heads", "origin", branchName],
    { reject: false }
  );
  return result.exitCode === 0 && result.stdout.trim().length > 0;
}

export async function getFilesChangedSinceBase(
  repoPath: string,
  baseBranch: string
): Promise<string[]> {
  const result = await execa(
    "git",
    ["-C", repoPath, "diff", "--name-only", `${baseBranch}...HEAD`],
    { reject: false }
  );
  if (result.exitCode !== 0) return [];
  return result.stdout
    .split("\n")
    .map((f) => f.trim())
    .filter(Boolean);
}

export async function getRemoteProjectPath(repoPath: string): Promise<string> {
  const { stdout } = await execa("git", ["-C", repoPath, "remote", "get-url", "origin"]);
  const url = stdout.trim();

  const project = parseGitLabProjectPathFromRemote(url);
  if (project) return project;

  throw new Error(`Could not parse GitLab project from remote: ${url}`);
}
