import { userInfo } from "node:os";
import type { RepoScope } from "./repos.js";
import { resolveRepoPaths } from "./server-env.js";

import type { AgentCommand } from "../contract/agent/commands.js";

export type { AgentCommand };

export interface CliArgs {
  command: AgentCommand;
  issueKey: string;
  agentId: string;
  clientPath: string;
  serverPath: string;
  local: boolean;
  message?: string;
  scope?: RepoScope;
  clientBase?: string;
  serverBase?: string;
  /** @deprecated Ship is always offered after validation; flag is ignored */
  ship: boolean;
  dryRun: boolean;
  verbose: boolean;
  fullSkills: boolean;
  maxAttempts: number;
  lint?: string;
  test?: string;
  e2e?: string;
}

function nextValue(argv: string[], index: number): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("-")) {
    throw new Error(`Missing value for ${argv[index]}`);
  }
  return value;
}

export function defaultAgentId(): string {
  return process.env.AGENT_ID?.trim() || userInfo().username || "default";
}

export function isRepoPath(path: string): boolean {
  return path.trim().toUpperCase() !== "N/A";
}

function parseCommand(token: string | undefined): AgentCommand {
  if (!token) return "start";
  const lower = token.toLowerCase();
  if (lower === "resume" || lower === "status" || lower === "list" || lower === "reset") {
    return lower;
  }
  throw new Error(`Unknown command: ${token} (expected resume, status, list, or reset)`);
}

export function parseCliArgs(argv: string[]): CliArgs {
  const positional: string[] = [];
  let clientPath: string | undefined;
  let serverPath: string | undefined;
  let message: string | undefined;
  let agentId = defaultAgentId();
  let scope: RepoScope | undefined;
  let clientBase: string | undefined;
  let serverBase: string | undefined;
  let ship = false;
  let local = false;
  let dryRun = false;
  let verbose = process.env.AGENT_VERBOSE === "1" || process.env.AGENT_VERBOSE === "true";
  let fullSkills = process.env.AGENT_FULL_SKILLS === "1" || process.env.AGENT_FULL_SKILLS === "true";
  let maxAttempts = Number(process.env.MAX_CODEX_ATTEMPTS ?? "3");
  let lint: string | undefined;
  let test: string | undefined;
  let e2e: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg) continue;

    switch (arg) {
      case "--client":
        clientPath = nextValue(argv, i);
        i++;
        break;
      case "--server":
        serverPath = nextValue(argv, i);
        i++;
        break;
      case "--agent-id":
        agentId = nextValue(argv, i);
        i++;
        break;
      case "--message":
      case "-m":
        message = nextValue(argv, i);
        i++;
        break;
      case "--scope":
        scope = nextValue(argv, i) as RepoScope;
        if (scope !== "client" && scope !== "server") {
          throw new Error("--scope must be client or server");
        }
        i++;
        break;
      case "--client-base":
        clientBase = nextValue(argv, i);
        i++;
        break;
      case "--server-base":
        serverBase = nextValue(argv, i);
        i++;
        break;
      case "--local":
        local = true;
        break;
      case "--ship":
        ship = true;
        break;
      case "--full-skills":
        fullSkills = true;
        break;
      case "--verbose":
      case "-v":
        verbose = true;
        break;
      case "--dry-run":
        dryRun = true;
        break;
      case "--max-attempts":
        maxAttempts = Number(nextValue(argv, i));
        i++;
        break;
      case "--lint":
        lint = nextValue(argv, i);
        i++;
        break;
      case "--test":
        test = nextValue(argv, i);
        i++;
        break;
      case "--e2e":
        e2e = nextValue(argv, i);
        i++;
        break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
        break;
      default:
        if (arg.startsWith("-")) {
          throw new Error(`Unknown flag: ${arg}`);
        }
        positional.push(arg);
    }
  }

  const first = positional[0];
  if (!first) {
    printHelp();
    throw new Error("Issue key required, e.g. AE-1234 (or: list)");
  }

  if (first.toLowerCase() === "list") {
    return {
      command: "list",
      issueKey: "LIST",
      agentId,
      clientPath: clientPath ?? "N/A",
      serverPath: serverPath ?? "N/A",
      local,
      ship,
      dryRun,
      verbose,
      fullSkills,
      maxAttempts,
      ...(message !== undefined ? { message } : {}),
      ...(scope !== undefined ? { scope } : {}),
      ...(clientBase !== undefined ? { clientBase } : {}),
      ...(serverBase !== undefined ? { serverBase } : {}),
      ...(lint !== undefined ? { lint } : {}),
      ...(test !== undefined ? { test } : {}),
      ...(e2e !== undefined ? { e2e } : {}),
    };
  }

  const issueKey = first;

  if (!/^AE-\d+$/i.test(issueKey)) {
    throw new Error(`Invalid issue key: ${issueKey} (expected AE-<digits>)`);
  }

  const command = parseCommand(positional[1]);

  if (command === "list") {
    return {
      command,
      issueKey: issueKey.toUpperCase(),
      agentId,
      clientPath: clientPath ?? "N/A",
      serverPath: serverPath ?? "N/A",
      local,
      ship,
      dryRun,
      verbose,
      fullSkills,
      maxAttempts,
      ...(message !== undefined ? { message } : {}),
      ...(scope !== undefined ? { scope } : {}),
      ...(clientBase !== undefined ? { clientBase } : {}),
      ...(serverBase !== undefined ? { serverBase } : {}),
      ...(lint !== undefined ? { lint } : {}),
      ...(test !== undefined ? { test } : {}),
      ...(e2e !== undefined ? { e2e } : {}),
    };
  }

  if (command === "status" || command === "resume" || command === "reset") {
    return {
      command,
      issueKey: issueKey.toUpperCase(),
      agentId,
      clientPath: clientPath ?? "N/A",
      serverPath: serverPath ?? "N/A",
      local,
      ship,
      dryRun,
      verbose,
      fullSkills,
      maxAttempts,
      ...(message !== undefined ? { message } : {}),
      ...(scope !== undefined ? { scope } : {}),
      ...(clientBase !== undefined ? { clientBase } : {}),
      ...(serverBase !== undefined ? { serverBase } : {}),
      ...(lint !== undefined ? { lint } : {}),
      ...(test !== undefined ? { test } : {}),
      ...(e2e !== undefined ? { e2e } : {}),
    };
  }

  if (dryRun && ship) {
    throw new Error("--dry-run and --ship are mutually exclusive");
  }

  const repos = resolveRepoPaths({
    ...(clientPath !== undefined ? { clientPath } : {}),
    ...(serverPath !== undefined ? { serverPath } : {}),
  });

  return {
    command,
    issueKey: issueKey.toUpperCase(),
    agentId,
    clientPath: repos.clientPath,
    serverPath: repos.serverPath,
    local,
    ship,
    dryRun,
    verbose,
    fullSkills,
    maxAttempts,
    ...(message !== undefined ? { message } : {}),
    ...(scope !== undefined ? { scope } : {}),
    ...(clientBase !== undefined ? { clientBase } : {}),
    ...(serverBase !== undefined ? { serverBase } : {}),
    ...(lint !== undefined ? { lint } : {}),
    ...(test !== undefined ? { test } : {}),
    ...(e2e !== undefined ? { e2e } : {}),
  };
}

function printHelp(): void {
  console.log(`
AI Dev Agent — daemon-backed CLI with checkpoint resume

Start the daemon first:
  ppnpm run agentd

Usage:
  pnpm run agent -- AE-1234 [options]
  pnpm run agent -- AE-1234 resume [-m "approve"] [--agent-id <id>]
  pnpm run agent -- AE-1234 status [--agent-id <id>]
  pnpm run agent -- AE-1234 reset [--agent-id <id>]
  pnpm run agent -- list [--agent-id <id>]

Repo paths (start):
  Set CLIENT_REPO_PATH and SERVER_REPO_PATH in .env (use N/A if not applicable)
  Optional overrides: --client <path> --server <path>

Options:
  --local               Run in-process without agentd
  --agent-id <id>       Agent identity for parallel runs (default: $USER or AGENT_ID)
  --message, -m <text>  Resume input: approve, reject, ship, or free-text feedback
  --scope client|server Target repo for implementation (default: inferred from ticket)
  --client-base <branch>  Override client merge base
  --server-base <branch>  Override server merge base
  --dry-run             Plan + approval only; no branch or implementation
  --verbose, -v         Stream Codex/lint output (default: quiet)
  --full-skills         Inline full skill bodies in prompt (default: lean paths only)
  --max-attempts <n>    Codex retry limit (default: 3)
  --lint <cmd>          Lint command override
  --test <cmd>          Test command override
  --e2e <cmd>           E2E test command override
  -h, --help            Show this help

Environment:
  CLIENT_REPO_PATH      Main client clone (or N/A)
  SERVER_REPO_PATH      Main server clone (or N/A)
  AGENT_SERVER_SOCKET   Unix socket path (default: .agent-runs/agent.sock)
  AGENT_ID              Default --agent-id
  OPENAI_API_KEY        Required for Codex

Examples:
  ppnpm run agentd
  pnpm run agent -- AE-1234 --dry-run
  pnpm run agent -- AE-1234 resume -m approve
  pnpm run agent -- AE-1234 reset
  pnpm run agent -- AE-1234 resume -m ship --agent-id ilan
`);
}
