import { defaultAgentId } from "./cli-args.js";

export interface SlackEnv {
  botToken: string;
  appToken: string;
  signingSecret: string;
  socketMode: boolean;
  agentId: string;
  allowedChannelIds: string[] | undefined;
}

export function loadSlackEnv(): SlackEnv {
  const botToken = process.env.SLACK_BOT_TOKEN?.trim();
  const appToken = process.env.SLACK_APP_TOKEN?.trim();
  const signingSecret = process.env.SLACK_SIGNING_SECRET?.trim();

  if (!botToken) throw new Error("SLACK_BOT_TOKEN is required");
  if (!appToken) throw new Error("SLACK_APP_TOKEN is required (Socket Mode)");
  if (!signingSecret) throw new Error("SLACK_SIGNING_SECRET is required");

  const mode = (process.env.SLACK_MODE?.trim() || "socket").toLowerCase();
  const allowedRaw = process.env.SLACK_ALLOWED_CHANNEL_IDS?.trim();
  const allowedChannelIds = allowedRaw
    ? allowedRaw.split(",").map((id) => id.trim()).filter(Boolean)
    : undefined;

  return {
    botToken,
    appToken,
    signingSecret,
    socketMode: mode === "socket",
    agentId: process.env.SLACK_AGENT_ID?.trim() || defaultAgentId(),
    allowedChannelIds,
  };
}
