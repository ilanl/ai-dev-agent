import { Command } from "@langchain/langgraph";
import { execa } from "execa";
import { isRepoPath, type CliArgs } from "./config/cli-args.js";
import { resolveRepoPaths } from "./config/server-env.js";
import { setVerbose } from "./config/verbosity.js";
import { invokeUntilIdle, type AgentGraph } from "./agent-runner.js";
import { buildGraph } from "./graph/build-graph.js";
import type { AgentStateType } from "./graph/state.js";
import { getCheckpointer } from "./integrations/checkpointer.js";
import { teardownAgentRunGit } from "./integrations/agent-worktree.js";
import { logAgentInfo } from "./integrations/agent-log.js";
import {
  formatInterruptNotice,
  formatPlanReview,
  type ReviewInterruptPayload,
} from "./integrations/human-review.js";
import {
  buildThreadId,
  deleteRunArtifacts,
  deleteRunMeta,
  listRunMeta,
  loadRunMeta,
  saveRunMeta,
  type RunMeta,
} from "./integrations/run-registry.js";

export type RunEvent =
  | { event: "run.started"; data: { threadId: string } }
  | { event: "interrupt"; data: ReviewInterruptPayload & { threadId: string } }
  | { event: "run.completed"; data: { threadId: string; status: AgentStateType["status"] } }
  | { event: "run.error"; data: { threadId: string; message: string } };

export interface RunResult {
  threadId: string;
  phase: "awaiting_input" | "completed" | "failed";
  status: AgentStateType["status"];
  interrupted: boolean;
  interrupt?: ReviewInterruptPayload;
  error?: string;
}

export interface RunStatusResult {
  threadId: string;
  agentId?: string;
  issueKey?: string;
  status?: AgentStateType["status"];
  error?: string;
  next: string[];
  planPath?: string;
  branchName?: string;
  activeRepoPath?: string;
  summary?: string;
  browseUrl?: string | null;
  scope?: AgentStateType["scope"];
  awaiting?: ReviewInterruptPayload["gate"];
  interrupt?: ReviewInterruptPayload;
}

export interface StartRunParams {
  issueKey: string;
  agentId: string;
  clientPath?: string;
  serverPath?: string;
  scope?: CliArgs["scope"];
  clientBase?: string;
  serverBase?: string;
  dryRun?: boolean;
  verbose?: boolean;
  fullSkills?: boolean;
  maxAttempts?: number;
  lint?: string;
  test?: string;
  e2e?: string;
}

export interface ResumeRunParams {
  threadId: string;
  message: string;
}

export interface ResetResult {
  threadId: string;
  checkpointDeleted: boolean;
  metaDeleted: boolean;
  artifactsDeleted: boolean;
  worktreesRemoved: number;
  branchesDeleted: number;
  gitCleanupErrors: string[];
}

export function normalizeResetResult(
  partial: Partial<ResetResult> & { threadId: string }
): ResetResult {
  return {
    threadId: partial.threadId,
    checkpointDeleted: partial.checkpointDeleted ?? false,
    metaDeleted: partial.metaDeleted ?? false,
    artifactsDeleted: partial.artifactsDeleted ?? false,
    worktreesRemoved: partial.worktreesRemoved ?? 0,
    branchesDeleted: partial.branchesDeleted ?? 0,
    gitCleanupErrors: partial.gitCleanupErrors ?? [],
  };
}

type EventEmitter = (event: RunEvent) => void;

export class RunCoordinator {
  private graph: AgentGraph | null = null;
  private inflight = new Map<string, Promise<unknown>>();

  private async getGraph(): Promise<AgentGraph> {
    if (!this.graph) {
      const checkpointer = await getCheckpointer();
      this.graph = buildGraph(checkpointer);
    }
    return this.graph;
  }

  private graphConfig(threadId: string) {
    return { configurable: { thread_id: threadId } };
  }

  private async withThreadLock<T>(threadId: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.inflight.get(threadId);
    if (existing) {
      throw new CoordinatorError("THREAD_BUSY", `Thread ${threadId} is already running`);
    }

    logAgentInfo("run.lock", { threadId, inflight: this.inflight.size + 1 });

    const task = fn().finally(() => {
      this.inflight.delete(threadId);
      logAgentInfo("run.unlock", { threadId, inflight: this.inflight.size });
    });
    this.inflight.set(threadId, task);
    return task;
  }

  isThreadBusy(threadId: string): boolean {
    return this.inflight.has(threadId);
  }

  async start(params: StartRunParams, emit?: EventEmitter): Promise<RunResult> {
    const repos = resolveRepoPaths({
      ...(params.clientPath !== undefined ? { clientPath: params.clientPath } : {}),
      ...(params.serverPath !== undefined ? { serverPath: params.serverPath } : {}),
    });

    const cli = buildCliArgs(params, repos);
    const threadId = buildThreadId(cli.agentId, cli.issueKey);
    const graph = await this.getGraph();
    const config = this.graphConfig(threadId);

    const existing = await graph.getState(config);
    if (existing.values && Object.keys(existing.values).length > 0) {
      throw new CoordinatorError(
        "THREAD_EXISTS",
        `Thread ${threadId} already exists. Use ticket.resume.`
      );
    }

    await this.persistMeta(threadId, cli, repos);

    return this.withThreadLock(threadId, async () => {
      emit?.({ event: "run.started", data: { threadId } });
      if (cli.verbose) setVerbose(true);

      try {
        const { state, interrupted, interruptPayload } = await invokeUntilIdle(
          graph,
          buildInitialState(cli, threadId),
          config
        );

        await this.persistMeta(threadId, cli, repos);
        logAgentInfo("run.phase", {
          threadId,
          status: state.status,
          interrupted,
          ...(interruptPayload ? { awaiting: interruptPayload.gate } : {}),
        });
        return this.toRunResult(threadId, state, interrupted, interruptPayload, emit);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        emit?.({ event: "run.error", data: { threadId, message } });
        throw err;
      }
    });
  }

  async resume(params: ResumeRunParams, emit?: EventEmitter): Promise<RunResult> {
    const graph = await this.getGraph();
    const config = this.graphConfig(params.threadId);

    const existing = await graph.getState(config);
    if (!existing.values || Object.keys(existing.values).length === 0) {
      throw new CoordinatorError(
        "THREAD_NOT_FOUND",
        `No checkpoint for thread ${params.threadId}`
      );
    }

    const values = existing.values as AgentStateType;
    if (values.cli.verbose) setVerbose(true);

    return this.withThreadLock(params.threadId, async () => {
      emit?.({ event: "run.started", data: { threadId: params.threadId } });
      console.log(`\n--- resume input (${params.threadId}) ---\n${params.message}`);

      try {
        const { state, interrupted, interruptPayload } = await invokeUntilIdle(
          graph,
          new Command({ resume: params.message }),
          config
        );

        const meta = await loadRunMeta(params.threadId);
        if (meta) {
          await saveRunMeta({ ...meta, updatedAt: new Date().toISOString() });
        }

        logAgentInfo("run.phase", {
          threadId: params.threadId,
          status: state.status,
          interrupted,
          ...(interruptPayload ? { awaiting: interruptPayload.gate } : {}),
        });
        return this.toRunResult(
          params.threadId,
          state,
          interrupted,
          interruptPayload,
          emit
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        emit?.({ event: "run.error", data: { threadId: params.threadId, message } });
        throw err;
      }
    });
  }

  async status(threadId: string): Promise<RunStatusResult> {
    const graph = await this.getGraph();
    const snapshot = await graph.getState(this.graphConfig(threadId));
    const values = snapshot.values as AgentStateType | undefined;
    const taskInterrupt = snapshot.tasks?.find((t) => t.interrupts?.length)?.interrupts?.[0]
      ?.value;
    const interrupt = isReviewPayload(taskInterrupt) ? taskInterrupt : undefined;

    const result: RunStatusResult = {
      threadId,
      next: [...snapshot.next],
    };

    if (values?.agentId) result.agentId = values.agentId;
    if (values?.jiraIssueKey) result.issueKey = values.jiraIssueKey;
    if (values?.status) result.status = values.status;
    if (values?.error) result.error = values.error;
    if (values?.planPath) result.planPath = values.planPath;
    if (values?.branchName) result.branchName = values.branchName;
    if (values?.activeRepoPath) result.activeRepoPath = values.activeRepoPath;
    if (values?.scope) result.scope = values.scope;
    if (values?.jira?.summary) result.summary = values.jira.summary;
    if (values?.jira?.jira.browseUrl !== undefined) {
      result.browseUrl = values.jira.jira.browseUrl;
    }
    if (interrupt) {
      const enriched: ReviewInterruptPayload = { ...interrupt };
      if (interrupt.gate === "plan") {
        const plan = interrupt.plan ?? values?.implementationPlan;
        if (plan) enriched.plan = plan;
        if (values?.openRisks?.length) enriched.openRisks = values.openRisks;
        if (values?.planPath) enriched.planPath = values.planPath;
      }
      result.awaiting = enriched.gate;
      result.interrupt = enriched;
    }

    return result;
  }

  async list(agentId?: string): Promise<RunMeta[]> {
    return listRunMeta(agentId);
  }

  async reset(threadId: string): Promise<ResetResult> {
    if (this.inflight.has(threadId)) {
      throw new CoordinatorError(
        "THREAD_BUSY",
        `Thread ${threadId} is running — wait for it to finish before reset`
      );
    }

    const graph = await this.getGraph();
    const config = this.graphConfig(threadId);
    const existing = await graph.getState(config);
    const hadCheckpoint = !!(
      existing.values && Object.keys(existing.values).length > 0
    );

    const meta = await loadRunMeta(threadId);
    const state = existing.values as AgentStateType | undefined;

    const scope = state?.scope ?? meta?.scope;
    const clientPath = state?.clientPath ?? meta?.clientPath;
    const serverPath = state?.serverPath ?? meta?.serverPath;
    const gitTeardown = await teardownAgentRunGit({
      threadId,
      ...(scope ? { scope } : {}),
      ...(state?.branchName ? { branchName: state.branchName } : {}),
      ...(clientPath ? { clientPath } : {}),
      ...(serverPath ? { serverPath } : {}),
    });

    if (gitTeardown.worktreesRemoved.length || gitTeardown.branchesDeleted.length) {
      logAgentInfo("reset.git", {
        threadId,
        worktrees: gitTeardown.worktreesRemoved.length,
        branches: gitTeardown.branchesDeleted.length,
      });
    }

    if (hadCheckpoint) {
      const checkpointer = await getCheckpointer();
      await checkpointer.deleteThread(threadId);
    }

    if (meta) {
      if (isRepoPath(meta.clientPath)) {
        await execa("git", ["-C", meta.clientPath, "worktree", "prune"], {
          reject: false,
        });
      }
      if (isRepoPath(meta.serverPath)) {
        await execa("git", ["-C", meta.serverPath, "worktree", "prune"], {
          reject: false,
        });
      }
    }

    const metaDeleted = await deleteRunMeta(threadId);

    let artifactsDeleted = false;
    try {
      await deleteRunArtifacts(threadId);
      artifactsDeleted = true;
    } catch {
      artifactsDeleted = false;
    }

    return {
      threadId,
      checkpointDeleted: hadCheckpoint,
      metaDeleted,
      artifactsDeleted,
      worktreesRemoved: gitTeardown.worktreesRemoved.length,
      branchesDeleted: gitTeardown.branchesDeleted.length,
      gitCleanupErrors: gitTeardown.errors,
    };
  }

  private toRunResult(
    threadId: string,
    state: AgentStateType,
    interrupted: boolean,
    interruptPayload: ReviewInterruptPayload | undefined,
    emit?: EventEmitter
  ): RunResult {
    if (interrupted && interruptPayload) {
      const payload = { ...interruptPayload, threadId };
      const notice =
        payload.gate === "plan" ? formatPlanReview(payload) : formatInterruptNotice(payload);
      console.log(notice);
      emit?.({ event: "interrupt", data: payload });
      return {
        threadId,
        phase: "awaiting_input",
        status: state.status,
        interrupted: true,
        interrupt: payload,
      };
    }

    emit?.({ event: "run.completed", data: { threadId, status: state.status } });

    const phase =
      state.status === "shipped" || state.status === "rejected"
        ? "completed"
        : state.status === "failed"
          ? "failed"
          : "completed";

    return {
      threadId,
      phase,
      status: state.status,
      interrupted: false,
      ...(state.error ? { error: state.error } : {}),
    };
  }

  private async persistMeta(
    threadId: string,
    cli: CliArgs,
    repos: { clientPath: string; serverPath: string }
  ): Promise<void> {
    await saveRunMeta({
      threadId,
      agentId: cli.agentId,
      issueKey: cli.issueKey,
      clientPath: repos.clientPath,
      serverPath: repos.serverPath,
      ...(cli.scope !== undefined ? { scope: cli.scope } : {}),
      updatedAt: new Date().toISOString(),
      cli: {
        dryRun: cli.dryRun,
        verbose: cli.verbose,
        fullSkills: cli.fullSkills,
        maxAttempts: cli.maxAttempts,
        ...(cli.lint !== undefined ? { lint: cli.lint } : {}),
        ...(cli.test !== undefined ? { test: cli.test } : {}),
        ...(cli.e2e !== undefined ? { e2e: cli.e2e } : {}),
      },
    });
  }
}

export class CoordinatorError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "CoordinatorError";
  }
}

let singleton: RunCoordinator | null = null;

export function getRunCoordinator(): RunCoordinator {
  if (!singleton) singleton = new RunCoordinator();
  return singleton;
}

function buildCliArgs(
  params: StartRunParams,
  repos: { clientPath: string; serverPath: string }
): CliArgs {
  return {
    command: "start",
    issueKey: params.issueKey.toUpperCase(),
    agentId: params.agentId,
    clientPath: repos.clientPath,
    serverPath: repos.serverPath,
    local: false,
    ship: false,
    dryRun: params.dryRun ?? false,
    verbose: params.verbose ?? false,
    fullSkills: params.fullSkills ?? false,
    maxAttempts: params.maxAttempts ?? Number(process.env.MAX_CODEX_ATTEMPTS ?? "3"),
    ...(params.scope !== undefined ? { scope: params.scope } : {}),
    ...(params.clientBase !== undefined ? { clientBase: params.clientBase } : {}),
    ...(params.serverBase !== undefined ? { serverBase: params.serverBase } : {}),
    ...(params.lint !== undefined ? { lint: params.lint } : {}),
    ...(params.test !== undefined ? { test: params.test } : {}),
    ...(params.e2e !== undefined ? { e2e: params.e2e } : {}),
  };
}

function buildInitialState(cli: CliArgs, threadId: string): AgentStateType {
  return {
    cli,
    agentId: cli.agentId,
    threadId,
    jiraIssueKey: cli.issueKey,
    clientPath: cli.clientPath,
    serverPath: cli.serverPath,
    scope: cli.scope ?? "server",
    jira: null,
    jiraText: "",
    coralogixContext: "",
    activeRepoPath: "",
    baseBranch: "",
    branchName: "",
    lintCommand: "",
    testCommand: "",
    codingRules: "",
    skillsContext: "",
    agentSkillsDir: "",
    implementationPlan: "",
    planPath: undefined,
    planApproved: false,
    planFeedback: undefined,
    shipApproved: false,
    shipFeedback: undefined,
    worktreeRoot: undefined,
    clientBase: undefined,
    serverBase: undefined,
    e2eCommand: undefined,
    nodeVersion: undefined,
    codexPlanSessionId: undefined,
    codexSessionId: undefined,
    retryFeedback: undefined,
    error: undefined,
    codexAttempts: 0,
    codexLastOutput: "",
    humanAnswers: [],
    lintResult: null,
    testResult: null,
    e2eResult: null,
    filesChanged: [],
    commitSubject: "",
    mrUrls: [],
    openRisks: [],
    status: "running",
  };
}

function isReviewPayload(value: unknown): value is ReviewInterruptPayload {
  return (
    typeof value === "object" &&
    value !== null &&
    "gate" in value &&
    "title" in value &&
    "body" in value
  );
}
