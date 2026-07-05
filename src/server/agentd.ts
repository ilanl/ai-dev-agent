import "dotenv/config";
import { mkdir, unlink } from "node:fs/promises";
import { createServer, type Server, type Socket } from "node:net";
import { dirname } from "node:path";
import { setDaemonMode } from "../config/daemon-context.js";
import { loadDeveloperRuntime } from "../config/developer-runtime.js";
import { loadServerEnv } from "../config/server-env.js";
import { PROTOCOL_VERSION } from "./protocol.js";
import { ClientConnection } from "./connection.js";

let server: Server | null = null;

async function bindUnixSocket(socketPath: string): Promise<Server> {
  await mkdir(dirname(socketPath), { recursive: true });
  try {
    await unlink(socketPath);
  } catch {
    // no stale socket
  }

  return new Promise((resolve, reject) => {
    const srv = createServer((socket) => onConnection(socket));
    srv.on("error", reject);
    srv.listen(socketPath, () => resolve(srv));
  });
}

function bindTcp(host: string, port: number): Server {
  const srv = createServer((socket) => onConnection(socket));
  srv.listen(port, host);
  return srv;
}

function onConnection(socket: Socket): void {
  const env = loadServerEnv();
  const conn = new ClientConnection(socket, env.defaultAgentId);
  conn.attach();
}

async function main(): Promise<void> {
  setDaemonMode(true);
  const env = loadServerEnv();

  server = await bindUnixSocket(env.socketPath);
  console.log(`agentd listening on unix://${env.socketPath}`);
  console.log(`agentd pid=${process.pid} protocol=${PROTOCOL_VERSION}`);

  if (env.tcpPort) {
    bindTcp(env.tcpHost, env.tcpPort);
    console.log(`agentd listening on tcp://${env.tcpHost}:${env.tcpPort}`);
  }

  console.log(`repos: client=${env.clientRepoPath} server=${env.serverRepoPath}`);
  const devRuntime = loadDeveloperRuntime();
  console.log(
    `developer runtime=${devRuntime.runtime}` +
      (devRuntime.runtime === "cursor" ? ` bin=${devRuntime.cursorAgentBin}` : "")
  );
  console.log(`agentd log level=${process.env.AGENT_LOG_LEVEL?.trim() || "info"}`);
}

function shutdown(): void {
  server?.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
