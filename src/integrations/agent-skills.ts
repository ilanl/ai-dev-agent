import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import type { RepoSkillMeta, SkillsMode } from "./repo-skills.js";
import {
  buildLeanSkillsContext,
  discoverSkillMeta,
  loadSkillsContext as loadRepoSkillsContext,
  rankSkillsForTicket,
} from "./repo-skills.js";

/** Agent skills shipped with ai-dev-agent under `.cursor/skills`. */
export const AGENT_SKILL_NAMES = [
  "strict-explicit-mode",
  "ticket-solver-investigate",
  "ticket-solver-paths",
  "ticket-solver-ship",
] as const;

const MAX_LEAN_DESC_CHARS = 100;
const DEFAULT_SKILLS_DIR = join(".cursor", "skills");

export function resolveAgentSkillsDir(): string {
  const fromEnv = process.env.AGENT_SKILLS_PATH?.trim();
  if (!fromEnv) {
    return resolve(process.cwd(), DEFAULT_SKILLS_DIR);
  }

  const expanded = fromEnv.replace(/^~/, homedir());
  return isAbsolute(expanded) ? expanded : resolve(process.cwd(), expanded);
}

async function readSkillMetaFromDir(
  skillsDir: string,
  skillName: string,
): Promise<RepoSkillMeta | null> {
  const absolutePath = join(skillsDir, skillName, "SKILL.md");
  try {
    const content = await readFile(absolutePath, "utf8");
    const { name, description } = parseFrontmatter(content, skillName);
    return {
      name,
      description: truncate(description, MAX_LEAN_DESC_CHARS),
      relativePath: join(DEFAULT_SKILLS_DIR, skillName, "SKILL.md"),
      absolutePath,
    };
  } catch {
    return null;
  }
}

function parseFrontmatter(
  content: string,
  fallbackName: string,
): { name: string; description: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match?.[1]) {
    return { name: fallbackName, description: "" };
  }

  const block = match[1];
  const name = block.match(/^name:\s*(.+)$/m)?.[1]?.trim() ?? fallbackName;
  const description =
    block.match(/^description:\s*["']?(.+?)["']?$/m)?.[1]?.trim() ??
    block.match(/^description:\s*(.+)$/m)?.[1]?.trim() ??
    "";

  return { name, description };
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

export async function loadAgentSkills(
  skillsDir = resolveAgentSkillsDir(),
): Promise<RepoSkillMeta[]> {
  const skills: RepoSkillMeta[] = [];

  for (const name of AGENT_SKILL_NAMES) {
    const meta = await readSkillMetaFromDir(skillsDir, name);
    if (meta) skills.push(meta);
  }

  return skills;
}

function formatSkillLine(skill: RepoSkillMeta): string {
  const desc = skill.description ? ` — ${skill.description}` : "";
  return `- \`${skill.absolutePath}\`${desc}`;
}

export function buildAgentSkillsContext(agentSkills: RepoSkillMeta[]): string {
  const skillsDir = resolveAgentSkillsDir();

  if (agentSkills.length === 0) {
    return [
      "# Agent skills",
      `No agent skills found under \`${skillsDir}\`.`,
      `Expected under \`${DEFAULT_SKILLS_DIR}/\`: strict-explicit-mode, ticket-solver-investigate, ticket-solver-paths, ticket-solver-ship.`,
    ].join("\n");
  }

  return [
    "# Agent skills (read from disk — not inlined)",
    `Directory: \`${skillsDir}\``,
    "Use for Jira/ticket workflow, shipping conventions, and scope discipline.",
    "This run allows exploring the **active repo**; apply strict-explicit-mode only where it does not conflict with that.",
    "",
    ...agentSkills.map(formatSkillLine),
  ].join("\n");
}

export interface AgentSkillsBundle {
  context: string;
  agentSkillsDir: string;
  agentSkillsFound: number;
}

export async function loadAgentSkillsContext(
  activeRepoPath: string,
  ticketText: string,
  mode: SkillsMode,
): Promise<AgentSkillsBundle> {
  const agentSkillsDir = resolveAgentSkillsDir();
  const agentSkills = await loadAgentSkills(agentSkillsDir);
  const agentBlock = buildAgentSkillsContext(agentSkills);

  if (mode === "full") {
    const repoBlock = await loadRepoSkillsContext(activeRepoPath, ticketText, "full");
    return {
      context: [agentBlock, "", repoBlock].join("\n"),
      agentSkillsDir,
      agentSkillsFound: agentSkills.length,
    };
  }

  const repoSkills = await discoverSkillMeta(activeRepoPath);
  const ranked = rankSkillsForTicket(repoSkills, ticketText, 5, 1);
  const repoBlock = buildLeanSkillsContext(ranked);

  return {
    context: [agentBlock, "", repoBlock].join("\n"),
    agentSkillsDir,
    agentSkillsFound: agentSkills.length,
  };
}
