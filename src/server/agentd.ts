import "dotenv/config";
import { mkdir, unlink } from "node:fs/promises";
import { createServer, type Server, type Socket } from "node:net";
import type { Server as HttpServer } from "node:http";
import { dirname } from "node:path";
import { setDaemonMode } from "../config/daemon-context.js";
import { loadDeveloperRuntime } from "../config/developer-runtime.js";
import { loadServerEnv } from "../config/server-env.js";
import { startHttpServer } from "./http-api.js";
import { PROTOCOL_VERSION } from "./protocol.js";
import { ClientConnection } from "./connection.js";

const DEFAULT_HTTP_PORT = 9478;

let unixServer: Server | null = null;
let tcpServer: Server | null = null;
let httpServer: HttpServer | null = null;

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
  const httpPort = Number(process.env.AGENT_HTTP_PORT ?? DEFAULT_HTTP_PORT);

  unixServer = await bindUnixSocket(env.socketPath);
  console.log(`agentd listening on unix://${env.socketPath}`);
  console.log(`agentd pid=${process.pid} protocol=${PROTOCOL_VERSION}`);

  httpServer = startHttpServer(httpPort);

  if (env.tcpPort && env.tcpPort !== httpPort) {
    tcpServer = bindTcp(env.tcpHost, env.tcpPort);
    console.log(`agentd listening on tcp://${env.tcpHost}:${env.tcpPort}`);
  } else if (env.tcpPort === httpPort) {
    console.log(
      `agentd tcp skipped — port ${httpPort} is used by the http api (set AGENT_SERVER_PORT to a different port for tcp)`,
    );
  }

  console.log(`repos: client=${env.clientRepoPath} server=${env.serverRepoPath}`);
  const devRuntime = loadDeveloperRuntime();
  console.log(
    `developer runtime=${devRuntime.runtime}` +
      (devRuntime.runtime === "cursor" ? ` bin=${devRuntime.cursorAgentBin}` : ""),
  );
  console.log(`agentd log level=${process.env.AGENT_LOG_LEVEL?.trim() || "info"}`);
}

function shutdown(): void {
  unixServer?.close();
  tcpServer?.close();
  httpServer?.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
