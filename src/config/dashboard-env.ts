import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { defaultAgentId } from "./cli-args.js";

export interface DashboardEnv {
  host: string;
  port: number;
  defaultAgentId: string;
  staticDir: string;
}

export function loadDashboardEnv(): DashboardEnv {
  const portRaw = process.env.DASHBOARD_PORT?.trim() || "9478";
  const port = Number(portRaw);
  if (!Number.isFinite(port) || port <= 0) {
    throw new Error(`Invalid DASHBOARD_PORT: ${portRaw}`);
  }

  return {
    host: process.env.DASHBOARD_HOST?.trim() || "127.0.0.1",
    port,
    defaultAgentId: process.env.DASHBOARD_AGENT_ID?.trim() || defaultAgentId(),
    staticDir:
      process.env.DASHBOARD_STATIC_DIR?.trim() ||
      join(fileURLToPath(new URL("../../app-ui/dist", import.meta.url))),
  };
}
