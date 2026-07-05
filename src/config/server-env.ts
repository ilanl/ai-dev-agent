import { access } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { defaultAgentId } from "./cli-args.js";

export interface RepoPaths {
  clientPath: string;
  serverPath: string;
}

export interface ServerEnv {
  clientRepoPath: string;
  serverRepoPath: string;
  socketPath: string;
  tcpHost: string;
  tcpPort: number | undefined;
  defaultAgentId: string;
}

function expandHome(path: string): string {
  return path.startsWith("~/") ? join(homedir(), path.slice(2)) : path;
}

export function resolveSocketPath(raw?: string): string {
  const value = raw?.trim() || ".agent-runs/agent.sock";
  const expanded = expandHome(value);
  return isAbsolute(expanded) ? expanded : resolve(process.cwd(), expanded);
}

export function loadServerEnv(): ServerEnv {
  const clientRepoPath = process.env.CLIENT_REPO_PATH?.trim() || "N/A";
  const serverRepoPath = process.env.SERVER_REPO_PATH?.trim() || "N/A";
  const tcpPortRaw = process.env.AGENT_SERVER_PORT?.trim();

  return {
    clientRepoPath,
    serverRepoPath,
    socketPath: resolveSocketPath(process.env.AGENT_SERVER_SOCKET),
    tcpHost: process.env.AGENT_SERVER_HOST?.trim() || "127.0.0.1",
    tcpPort: tcpPortRaw ? Number(tcpPortRaw) : undefined,
    defaultAgentId: defaultAgentId(),
  };
}

export function resolveRepoPaths(overrides?: {
  clientPath?: string;
  serverPath?: string;
}): RepoPaths {
  const env = loadServerEnv();
  const clientPath = overrides?.clientPath?.trim() || env.clientRepoPath;
  const serverPath = overrides?.serverPath?.trim() || env.serverRepoPath;

  if (clientPath.toUpperCase() === "N/A" && serverPath.toUpperCase() === "N/A") {
    throw new Error(
      "Set CLIENT_REPO_PATH and/or SERVER_REPO_PATH in .env (or pass --client / --server)"
    );
  }

  return { clientPath, serverPath };
}

export async function socketExists(socketPath: string): Promise<boolean> {
  try {
    await access(socketPath);
    return true;
  } catch {
    return false;
  }
}
