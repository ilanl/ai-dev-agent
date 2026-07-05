import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { RepoSkillMeta, SkillsMode } from "./repo-skills.js";
import {
  buildLeanSkillsContext,
  discoverSkillMeta,
  loadSkillsContext as loadRepoSkillsContext,
  rankSkillsForTicket,
} from "./repo-skills.js";

/** Global Cursor skills used by this agent (not repo-local). */
export const AGENT_GLOBAL_SKILL_NAMES = [
  "strict-explicit-mode",
  "ticket-solver-investigate",
  "ticket-solver-paths",
  "ticket-solver-ship",
] as const;

const MAX_LEAN_DESC_CHARS = 100;

export function resolveGlobalSkillsDir(): string {
  const fromEnv = process.env.GLOBAL_SKILLS_PATH?.trim();
  if (fromEnv) return fromEnv.replace(/^~/, homedir());
  return join(homedir(), ".cursor", "skills");
}

async function readSkillMetaFromDir(
  skillsDir: string,
  skillName: string
): Promise<RepoSkillMeta | null> {
  const absolutePath = join(skillsDir, skillName, "SKILL.md");
  try {
    const content = await readFile(absolutePath, "utf8");
    const { name, description } = parseFrontmatter(content, skillName);
    return {
      name,
      description: truncate(description, MAX_LEAN_DESC_CHARS),
      relativePath: `${skillsDir}/${skillName}/SKILL.md`,
      absolutePath,
    };
  } catch {
    return null;
  }
}

function parseFrontmatter(
  content: string,
  fallbackName: string
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

export async function loadAgentGlobalSkills(
  skillsDir = resolveGlobalSkillsDir()
): Promise<RepoSkillMeta[]> {
  const skills: RepoSkillMeta[] = [];

  for (const name of AGENT_GLOBAL_SKILL_NAMES) {
    const meta = await readSkillMetaFromDir(skillsDir, name);
    if (meta) skills.push(meta);
  }

  return skills;
}

function formatSkillLine(skill: RepoSkillMeta): string {
  const desc = skill.description ? ` — ${skill.description}` : "";
  return `- \`${skill.absolutePath}\`${desc}`;
}

export function buildGlobalSkillsContext(globalSkills: RepoSkillMeta[]): string {
  if (globalSkills.length === 0) {
    return [
      "# Global agent skills",
      `No global skills found under \`${resolveGlobalSkillsDir()}\`.`,
      "Expected: strict-explicit-mode, ticket-solver-investigate, ticket-solver-paths, ticket-solver-ship.",
    ].join("\n");
  }

  return [
    "# Global agent skills (read from disk — not inlined)",
    `Directory: \`${resolveGlobalSkillsDir()}\``,
    "Use for Jira/ticket workflow, shipping conventions, and scope discipline.",
    "This run allows exploring the **active repo**; apply strict-explicit-mode only where it does not conflict with that.",
    "",
    ...globalSkills.map(formatSkillLine),
  ].join("\n");
}

export interface AgentSkillsBundle {
  context: string;
  globalSkillsDir: string;
  globalSkillsFound: number;
}

export async function loadAgentSkillsContext(
  activeRepoPath: string,
  ticketText: string,
  mode: SkillsMode
): Promise<AgentSkillsBundle> {
  const globalSkillsDir = resolveGlobalSkillsDir();
  const globalSkills = await loadAgentGlobalSkills(globalSkillsDir);

  const globalBlock = buildGlobalSkillsContext(globalSkills);

  if (mode === "full") {
    const repoBlock = await loadRepoSkillsContext(activeRepoPath, ticketText, "full");
    return {
      context: [globalBlock, "", repoBlock].join("\n"),
      globalSkillsDir,
      globalSkillsFound: globalSkills.length,
    };
  }

  const repoSkills = await discoverSkillMeta(activeRepoPath);
  const ranked = rankSkillsForTicket(repoSkills, ticketText, 5, 1);
  const repoBlock = buildLeanSkillsContext(ranked);

  return {
    context: [globalBlock, "", repoBlock].join("\n"),
    globalSkillsDir,
    globalSkillsFound: globalSkills.length,
  };
}
