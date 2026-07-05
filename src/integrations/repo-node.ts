import { readFile } from "node:fs/promises";
import { join } from "node:path";

export async function readNvmrc(repoPath: string): Promise<string | undefined> {
  try {
    const version = (await readFile(join(repoPath, ".nvmrc"), "utf8")).trim();
    return version || undefined;
  } catch {
    return undefined;
  }
}

/** Prefix a shell command with nvm use when the repo has .nvmrc */
export function wrapCommandWithNvm(command: string, nodeVersion: string | undefined): string {
  if (!nodeVersion) return command;

  return [
    'export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"',
    '[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"',
    `nvm use ${nodeVersion}`,
    command,
  ].join(" && ");
}

export function nodeVersionFromNvmrc(nvmrc: string): string {
  return nvmrc.startsWith("v") ? nvmrc : `v${nvmrc}`;
}
