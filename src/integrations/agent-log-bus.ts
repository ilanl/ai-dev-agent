export type AgentLogLine = {
  ts: string;
  level: "info" | "debug";
  event: string;
  message: string;
};

const MAX_BUFFER = 500;

const buffer: AgentLogLine[] = [];
const subscribers = new Set<(line: AgentLogLine) => void>();

export const publishAgentLog = (line: AgentLogLine): void => {
  buffer.push(line);
  if (buffer.length > MAX_BUFFER) buffer.shift();
  for (const subscriber of subscribers) subscriber(line);
};

export const subscribeAgentLog = (
  listener: (line: AgentLogLine) => void,
): (() => void) => {
  subscribers.add(listener);
  return () => subscribers.delete(listener);
};

export const getAgentLogBuffer = (): readonly AgentLogLine[] => buffer;
