import { execa } from "execa";

export interface CreateMergeRequestOptions {
  repoPath: string;
  title: string;
  description: string;
  sourceBranch: string;
  targetBranch: string;
}

export interface MergeRequestResult {
  url: string;
  iid?: number;
}

export async function createDraftMergeRequest(
  options: CreateMergeRequestOptions
): Promise<MergeRequestResult> {
  const project = await import("./git.js").then((m) => m.getRemoteProjectPath(options.repoPath));

  const { stdout } = await execa(
    "glab",
    [
      "mr",
      "create",
      "--repo",
      project,
      "--title",
      options.title,
      "--description",
      options.description,
      "--source-branch",
      options.sourceBranch,
      "--target-branch",
      options.targetBranch,
      "--draft",
      "--yes",
    ],
    { cwd: options.repoPath }
  );

  const urlMatch = stdout.match(/https?:\/\/\S+/);
  if (!urlMatch) {
    throw new Error(`glab mr create did not return a URL:\n${stdout}`);
  }

  return { url: urlMatch[0] };
}
