import { z } from "zod";

export const PROTOCOL_VERSION = 1;

export const CLIENT_MESSAGE_TYPE = {
  HELLO: "hello",
  REQ: "req",
} as const;

export const SERVER_MESSAGE_TYPE = {
  WELCOME: "welcome",
  RES: "res",
  EVENT: "event",
} as const;

export const HelloMessage = z.object({
  type: z.literal(CLIENT_MESSAGE_TYPE.HELLO),
  version: z.number().optional(),
  client: z.string().optional(),
  agentId: z.string().optional(),
});

export const RequestMessage = z.object({
  type: z.literal(CLIENT_MESSAGE_TYPE.REQ),
  id: z.string(),
  method: z.string(),
  params: z.record(z.string(), z.unknown()).optional(),
});

export const ResponseMessage = z.object({
  type: z.literal(SERVER_MESSAGE_TYPE.RES),
  id: z.string(),
  ok: z.boolean(),
  result: z.unknown().optional(),
  error: z
    .object({
      code: z.string(),
      message: z.string(),
    })
    .optional(),
});

export const EventMessage = z.object({
  type: z.literal(SERVER_MESSAGE_TYPE.EVENT),
  event: z.string(),
  data: z.unknown(),
});

export const WelcomeMessage = z.object({
  type: z.literal(SERVER_MESSAGE_TYPE.WELCOME),
  version: z.number(),
  server: z.string(),
  defaultAgentId: z.string(),
  repos: z.object({
    client: z.string(),
    server: z.string(),
  }),
});

export type HelloMessage = z.infer<typeof HelloMessage>;
export type RequestMessage = z.infer<typeof RequestMessage>;
export type ResponseMessage = z.infer<typeof ResponseMessage>;
export type EventMessage = z.infer<typeof EventMessage>;
export type WelcomeMessage = z.infer<typeof WelcomeMessage>;

export type InboundMessage = HelloMessage | RequestMessage;
export type OutboundMessage = ResponseMessage | EventMessage | WelcomeMessage;

export function parseInboundLine(line: string): InboundMessage {
  const json: unknown = JSON.parse(line);
  if (typeof json !== "object" || json === null || !("type" in json)) {
    throw new Error("Invalid message: missing type");
  }

  const type = (json as { type: string }).type;
  if (type === CLIENT_MESSAGE_TYPE.HELLO) return HelloMessage.parse(json);
  if (type === CLIENT_MESSAGE_TYPE.REQ) return RequestMessage.parse(json);
  throw new Error(`Invalid message type: ${type}`);
}

export function encodeOutbound(message: OutboundMessage): string {
  return `${JSON.stringify(message)}\n`;
}

export class ProtocolError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ProtocolError";
  }
}
