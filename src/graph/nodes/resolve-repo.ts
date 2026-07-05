import { isRepoPath } from "../../config/cli-args.js";
import { inferScopeFromTicket, loadReposConfig } from "../../config/repos.js";
import { logNodeDone, logNodeStart } from "../../integrations/agent-log.js";
import { loadAgentsMd } from "../../integrations/codex.js";
import { getCurrentBranch } from "../../integrations/git.js";
import { nodeVersionFromNvmrc, readNvmrc } from "../../integrations/repo-node.js";
import { loadAgentSkillsContext } from "../../integrations/agent-skills.js";
import { resolveSkillsMode } from "../../integrations/repo-skills.js";
import type { AgentStateType } from "../state.js";

async function resolveBase(
  path: string,
  override: string | undefined
): Promise<string | undefined> {
  if (!isRepoPath(path)) return undefined;
  return override ?? getCurrentBranch(path);
}

export async function resolveRepo(state: AgentStateType): Promise<Partial<AgentStateType>> {
  if (!state.jira) {
    throw new Error("Jira data missing — fetchJira must run first");
  }

  logNodeStart("resolveRepo", { threadId: state.threadId, issueKey: state.jiraIssueKey });

  const config = await loadReposConfig();
  const cli = state.cli;

  const clientPath = cli.clientPath;
  const serverPath = cli.serverPath;

  const scope =
    cli.scope ??
    inferScopeFromTicket(state.jira.summary, state.jira.descriptionPlain);

  const clientBase = await resolveBase(clientPath, cli.clientBase);
  const serverBase = await resolveBase(serverPath, cli.serverBase);

  let activeRepoPath: string;
  let baseBranch: string;

  if (scope === "client") {
    if (!isRepoPath(clientPath)) {
      throw new Error(
        "Client scope selected but --client is N/A. Use --scope server or provide a client path."
      );
    }
    activeRepoPath = clientPath;
    baseBranch = clientBase!;
  } else {
    if (!isRepoPath(serverPath)) {
      throw new Error(
        "Server scope selected but --server is N/A. Use --scope client or provide a server path."
      );
    }
    activeRepoPath = serverPath;
    baseBranch = serverBase!;
  }

  const profile = scope === "client" ? config.client : config.server;
  const codingRules = await loadAgentsMd(activeRepoPath);
  const skillsBundle = await loadAgentSkillsContext(
    activeRepoPath,
    `${state.jiraText}\n${state.jira.summary}\n${state.jira.descriptionPlain}`,
    resolveSkillsMode(cli)
  );
  const nvmrc = await readNvmrc(activeRepoPath);
  const nodeVersion = nvmrc ? nodeVersionFromNvmrc(nvmrc) : undefined;

  logNodeDone("resolveRepo", {
    threadId: state.threadId,
    scope,
    repo: activeRepoPath,
    base: baseBranch,
  });

  return {
    scope,
    clientPath,
    serverPath,
    clientBase,
    serverBase,
    activeRepoPath,
    baseBranch,
    codingRules,
    skillsContext: skillsBundle.context,
    agentSkillsDir: skillsBundle.agentSkillsDir,
    nodeVersion,
    lintCommand: cli.lint ?? profile.lint,
    testCommand: cli.test ?? profile.test,
    e2eCommand: cli.e2e ?? profile.e2e,
  };
}
