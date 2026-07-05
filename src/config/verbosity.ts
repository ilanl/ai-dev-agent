import { isDaemonMode } from "./daemon-context.js";

let verbose =
  process.env.AGENT_VERBOSE === "1" || process.env.AGENT_VERBOSE === "true";

export function setVerbose(enabled: boolean): void {
  verbose = enabled;
}

export function isVerbose(): boolean {
  return verbose && !isDaemonMode();
}

/** Always shown — approvals, summary, errors */
export function logAlways(...args: unknown[]): void {
  console.log(...args);
}

/** One-line progress */
export function logStep(message: string): void {
  console.log(message);
}

/** Detailed output only with --verbose / AGENT_VERBOSE=1 */
export function logVerbose(...args: unknown[]): void {
  if (verbose) console.log(...args);
}

export function writeVerbose(stream: NodeJS.WriteStream, chunk: string | Buffer): void {
  if (verbose) stream.write(chunk);
}
