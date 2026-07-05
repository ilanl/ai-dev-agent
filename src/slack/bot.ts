import "dotenv/config";
import { App, LogLevel, SocketModeReceiver, type SayFn, type SayArguments } from "@slack/bolt";
import type { WebClient } from "@slack/web-api";
import { loadSlackEnv } from "../config/slack-env.js";
import {
  bindSlackThread,
  loadSlackThread,
  makeBinding,
  unbindSlackThread,
  type SlackThreadBinding,
} from "../integrations/slack-thread-store.js";
import { AgentGateway } from "../server/agent-gateway.js";
import {
  formatListForSlack,
  formatResetForSlack,
  formatRunResult,
  formatStatusForSlack,
  splitSlackText,
} from "./format.js";
import {
  logEnvelope,
  logError,
  logGateway,
  logIncoming,
  logOutgoing,
  logParsed,
  logSkip,
  logStartup,
  logStartupChecklist,
} from "./log.js";
import { helpText, parseSlackText } from "./parse-command.js";

function isBotMessage(message: { subtype?: string | undefined; bot_id?: string | undefined }): boolean {
  return message.subtype === "bot_message" || !!message.bot_id;
}

function channelAllowed(channelId: string, allowed: string[] | undefined): boolean {
  if (!allowed?.length) return true;
  return allowed.includes(channelId);
}

async function sayLogged(
  say: SayFn,
  channel: string,
  args: SayArguments
): Promise<void> {
  const text =
    "text" in args && typeof args.text === "string"
      ? args.text
      : "blocks" in args
        ? "(blocks)"
        : "";
  logOutgoing("say", {
    channel,
    threadTs: args.thread_ts,
    text,
  });
  await say(args);
}

async function postChunks(
  client: WebClient,
  channel: string,
  threadTs: string,
  chunks: string[]
): Promise<void> {
  logOutgoing("postMessage", {
    channel,
    threadTs,
    text: chunks[0] ?? "",
    chunks: chunks.length,
  });
  for (const text of chunks) {
    await client.chat.postMessage({ channel, thread_ts: threadTs, text });
  }
}

async function postError(
  client: WebClient,
  channel: string,
  threadTs: string | undefined,
  err: unknown
): Promise<void> {
  const message = err instanceof Error ? err.message : String(err);
  const chunks = splitSlackText(`:x: ${message}`);
  logOutgoing("postMessage", {
    channel,
    threadTs,
    text: chunks[0] ?? "",
    chunks: chunks.length,
  });
  for (const text of chunks) {
    await client.chat.postMessage({
      channel,
      ...(threadTs ? { thread_ts: threadTs } : {}),
      text,
    });
  }
}

async function handleThreadReply(
  gateway: AgentGateway,
  binding: SlackThreadBinding,
  text: string,
  client: WebClient
): Promise<void> {
  logParsed("thread_reply", binding.issueKey);
  logGateway("resume", { issueKey: binding.issueKey, threadId: binding.threadId });

  await client.chat.postMessage({
    channel: binding.channelId,
    thread_ts: binding.threadTs,
    text: "_Processing…_",
  });
  logOutgoing("postMessage", {
    channel: binding.channelId,
    threadTs: binding.threadTs,
    text: "_Processing…_",
  });

  const result = await gateway.resume(binding.issueKey, text);
  logGateway("resume.done", {
    issueKey: binding.issueKey,
    threadId: result.threadId,
    status: result.status,
    phase: result.phase,
    interrupted: result.interrupted,
    ...(result.error ? { error: result.error } : {}),
  });

  await postChunks(client, binding.channelId, binding.threadTs, formatRunResult(result));
  await bindSlackThread({ ...binding, updatedAt: new Date().toISOString() });
}

async function handleCommand(
  gateway: AgentGateway,
  agentId: string,
  text: string,
  channel: string,
  rootTs: string,
  replyThreadTs: string | undefined,
  say: SayFn,
  client: WebClient
): Promise<void> {
  const parsed = parseSlackText(text);
  logParsed(
    parsed.type,
    parsed.type === "start" || parsed.type === "reset" || parsed.type === "status"
      ? parsed.issueKey
      : undefined
  );

  const threadTs = replyThreadTs ?? rootTs;

  switch (parsed.type) {
    case "help":
      await sayLogged(say, channel, {
        text: helpText(),
        ...(replyThreadTs ? { thread_ts: replyThreadTs } : {}),
      });
      return;

    case "list": {
      logGateway("list", { agentId });
      const runs = await gateway.list();
      logGateway("list.done", { count: runs.length });
      await sayLogged(say, channel, {
        text: formatListForSlack(runs),
        ...(replyThreadTs ? { thread_ts: replyThreadTs } : { thread_ts: rootTs }),
      });
      return;
    }

    case "status": {
      let issueKey = parsed.issueKey;
      if (!issueKey) {
        const binding = await loadSlackThread(channel, threadTs);
        if (!binding) {
          await sayLogged(say, channel, {
            text: "No ticket bound to this thread. Use `status AE-1234`.",
            thread_ts: threadTs,
          });
          return;
        }
        issueKey = binding.issueKey;
      }
      logGateway("status", { issueKey });
      const status = await gateway.status(issueKey);
      logGateway("status.done", {
        issueKey,
        threadId: status.threadId,
        status: status.status,
        awaiting: status.awaiting,
      });
      await postChunks(client, channel, threadTs, formatStatusForSlack(status));
      return;
    }

    case "reset": {
      logGateway("reset", { issueKey: parsed.issueKey });
      const result = await gateway.reset(parsed.issueKey);
      logGateway("reset.done", { threadId: result.threadId });
      await unbindIfPresent(channel, threadTs, parsed.issueKey);
      await sayLogged(say, channel, {
        text: formatResetForSlack(result),
        thread_ts: threadTs,
      });
      return;
    }

    case "start": {
      logGateway("start", { issueKey: parsed.issueKey, agentId });
      await sayLogged(say, channel, {
        text: `Starting \`${parsed.issueKey}\`…`,
        thread_ts: threadTs,
      });
      const result = await gateway.start(parsed.issueKey);
      logGateway("start.done", {
        issueKey: parsed.issueKey,
        threadId: result.threadId,
        status: result.status,
        phase: result.phase,
        interrupted: result.interrupted,
        ...(result.error ? { error: result.error } : {}),
      });
      await bindSlackThread(
        makeBinding({
          channelId: channel,
          threadTs,
          issueKey: parsed.issueKey,
          agentId,
        })
      );
      await postChunks(client, channel, threadTs, formatRunResult(result));
      return;
    }

    case "message": {
      const binding = await loadSlackThread(channel, threadTs);
      if (!binding) {
        await sayLogged(say, channel, {
          text: "No active run in this thread. Start with `AE-1234` or mention me.",
          thread_ts: threadTs,
        });
        return;
      }
      await handleThreadReply(gateway, binding, parsed.text, client);
      return;
    }
  }
}

async function unbindIfPresent(
  channel: string,
  threadTs: string,
  issueKey: string
): Promise<void> {
  const binding = await loadSlackThread(channel, threadTs);
  if (binding?.issueKey === issueKey.toUpperCase()) {
    await unbindSlackThread(channel, threadTs);
  }
}

async function main(): Promise<void> {
  const env = loadSlackEnv();
  if (!env.socketMode) {
    throw new Error("Only SLACK_MODE=socket is supported");
  }

  const gateway = new AgentGateway(env.agentId, (event) => {
    const data = event.data as { threadId?: string; gate?: string; status?: string; message?: string };
    logGateway("event", {
      event: event.event,
      ...(data.threadId ? { threadId: data.threadId } : {}),
      ...(data.gate ? { gate: data.gate } : {}),
      ...(data.status ? { status: data.status } : {}),
      ...(data.message ? { error: data.message } : {}),
    });
  });

  const boltLogLevel =
    process.env.SLACK_LOG_LEVEL === "debug" ? LogLevel.DEBUG : LogLevel.INFO;

  const receiver = new SocketModeReceiver({
    appToken: env.appToken,
    logLevel: boltLogLevel,
  });

  receiver.client.on("slack_event", (args) => {
    const body = args.body as { event?: { type?: string; channel?: string } };
    const eventType = body.event?.type;
    if (eventType) {
      logEnvelope(eventType, body.event?.channel);
    }
  });

  const app = new App({
    token: env.botToken,
    signingSecret: env.signingSecret,
    receiver,
    logLevel: boltLogLevel,
  });

  app.event("app_mention", async ({ event, say, client }) => {
    if (!event.text) {
      logSkip("no_text", { source: "app_mention", channel: event.channel });
      return;
    }
    if (!channelAllowed(event.channel, env.allowedChannelIds)) {
      logSkip("channel_not_allowed", { channel: event.channel });
      return;
    }

    logIncoming("app_mention", {
      channel: event.channel,
      user: event.user,
      text: event.text,
      ts: event.ts,
      ...(event.thread_ts ? { threadTs: event.thread_ts } : {}),
    });

    try {
      await handleCommand(
        gateway,
        env.agentId,
        event.text,
        event.channel,
        event.ts,
        event.thread_ts,
        say,
        client
      );
    } catch (err) {
      logError("app_mention", err);
      await postError(client, event.channel, event.thread_ts ?? event.ts, err);
    }
  });

  app.message(async ({ message, say, client }) => {
    if (message.subtype || !("text" in message) || !message.text) {
      if (process.env.SLACK_LOG_LEVEL === "debug") {
        logSkip("not_user_text", {
          subtype: message.subtype ?? "(none)",
          channel: message.channel,
        });
      }
      return;
    }
    if (isBotMessage(message)) {
      logSkip("bot_message", { channel: message.channel });
      return;
    }
    if (!channelAllowed(message.channel, env.allowedChannelIds)) {
      logSkip("channel_not_allowed", { channel: message.channel });
      return;
    }

    const isDm = message.channel.startsWith("D");
    const isThreadReply = !!message.thread_ts;

    if (isThreadReply) {
      const binding = await loadSlackThread(message.channel, message.thread_ts!);
      if (binding) {
        logIncoming("message", {
          channel: message.channel,
          user: "user" in message ? message.user : undefined,
          text: message.text,
          ts: message.ts,
          threadTs: message.thread_ts,
        });
        try {
          await handleThreadReply(gateway, binding, message.text, client);
        } catch (err) {
          logError("thread_reply", err);
          await postError(client, message.channel, message.thread_ts, err);
        }
        return;
      }
    }

    if (!isDm && !isThreadReply) {
      const cmd = parseSlackText(message.text);
      const direct =
        cmd.type === "start" ||
        cmd.type === "list" ||
        cmd.type === "help" ||
        cmd.type === "reset" ||
        (cmd.type === "status" && !!cmd.issueKey);
      if (!direct) {
        logSkip("not_command", { channel: message.channel, text: message.text });
        return;
      }
    }

    logIncoming("message", {
      channel: message.channel,
      user: "user" in message ? message.user : undefined,
      text: message.text,
      ts: message.ts,
      ...(message.thread_ts ? { threadTs: message.thread_ts } : {}),
    });

    try {
      await handleCommand(
        gateway,
        env.agentId,
        message.text,
        message.channel,
        message.ts,
        message.thread_ts,
        say,
        client
      );
    } catch (err) {
      logError("message", err);
      await postError(client, message.channel, message.thread_ts ?? message.ts, err);
    }
  });

  await app.start();

  const auth = await app.client.auth.test();
  logStartup({
    agent: env.agentId,
    mode: "socket",
    botUser: auth.user_id,
    team: auth.team,
    ...(env.allowedChannelIds?.length
      ? { allowedChannels: env.allowedChannelIds.join(",") }
      : {}),
  });

  logStartupChecklist([
    env.allowedChannelIds?.length
      ? `channel allowlist ON — only ${env.allowedChannelIds.join(", ")} (right-click channel → copy ID)`
      : "channel allowlist off — any invited channel works",
    "api.slack.com → your app → Event Subscriptions → Enable Events ON",
    "Subscribe to bot events: app_mention, message.channels, message.im",
    "Reinstall app after scope/event changes",
    `/invite @${auth.user ?? "ai_dev_agent"} in the target channel`,
    "If @mention shows no [slack] envelope log → events not reaching this process",
  ]);
}

main().catch((err) => {
  logError("fatal", err);
  process.exit(1);
});
