import "dotenv/config";
import { WebSocketServer } from "ws";
import { loadDashboardEnv } from "../config/dashboard-env.js";
import { DashboardBridge } from "./bridge.js";
import { createDashboardServer } from "./http.js";

async function main(): Promise<void> {
  const env = loadDashboardEnv();
  const bridge = new DashboardBridge(env.defaultAgentId);
  const httpServer = createDashboardServer(bridge, env);

  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", (ws) => {
    bridge.addClient(ws);
    ws.send(JSON.stringify({ type: "agent.changed", data: { agentId: bridge.getAgentId() } }));
  });

  httpServer.listen(env.port, env.host, () => {
    console.log(`dashboard listening on http://${env.host}:${env.port}`);
    console.log(`agent: ${env.defaultAgentId}`);
    console.log(`static: ${env.staticDir}`);
    console.log("requires agentd: npm run agentd");
  });
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
