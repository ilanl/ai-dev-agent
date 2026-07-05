const PREFIX = "[slack]";

function trunc(text: string, max = 400): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  if (oneLine.length <= max) return oneLine;
  return `${oneLine.slice(0, max)}…`;
}

function fmt(fields: Record<string, unknown>): string {
  return Object.entries(fields)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${k}=${typeof v === "string" ? JSON.stringify(v) : String(v)}`)
    .join(" ");
}

export function logIncoming(
  source: "app_mention" | "message",
  fields: {
    channel: string;
    user?: string | undefined;
    text: string;
    ts: string;
    threadTs?: string | undefined;
  }
): void {
  console.log(
    `${PREFIX} ← ${source} ${fmt({
      channel: fields.channel,
      user: fields.user,
      ts: fields.ts,
      thread: fields.threadTs,
      text: trunc(fields.text),
    })}`
  );
}

export function logSkip(reason: string, fields: Record<string, unknown>): void {
  console.log(`${PREFIX} skip ${reason} ${fmt(fields)}`);
}

export function logParsed(command: string, issueKey?: string): void {
  console.log(
    `${PREFIX} parsed ${fmt({
      command,
      ...(issueKey ? { issueKey } : {}),
    })}`
  );
}

export function logGateway(
  action: string,
  fields: Record<string, unknown> & { issueKey?: string; threadId?: string }
): void {
  console.log(`${PREFIX} gateway.${action} ${fmt(fields)}`);
}

export function logOutgoing(
  via: "say" | "postMessage",
  fields: {
    channel: string;
    threadTs?: string | undefined;
    text: string;
    chunks?: number;
  }
): void {
  console.log(
    `${PREFIX} → ${via} ${fmt({
      channel: fields.channel,
      thread: fields.threadTs,
      ...(fields.chunks && fields.chunks > 1 ? { chunks: fields.chunks } : {}),
      text: trunc(fields.text),
    })}`
  );
}

export function logError(context: string, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`${PREFIX} error ${context} ${fmt({ message })}`);
}

export function logEnvelope(eventType: string, channel?: string): void {
  console.log(
    `${PREFIX} envelope ${fmt({
      event: eventType,
      ...(channel ? { channel } : {}),
    })}`
  );
}

export function logStartup(fields: Record<string, unknown>): void {
  console.log(`${PREFIX} startup ${fmt(fields)}`);
}

export function logStartupChecklist(lines: string[]): void {
  for (const line of lines) {
    console.log(`${PREFIX} setup ${line}`);
  }
}
