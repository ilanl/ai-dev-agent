import { open, readdir } from "node:fs/promises";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export type SkillsMode = "lean" | "full";

export interface RepoSkillMeta {
  name: string;
  description: string;
  relativePath: string;
  absolutePath: string;
}

export interface RepoSkill extends RepoSkillMeta {
  content: string;
}

const SKILLS_DIR = ".cursor/skills";
const MAX_INLINE_SKILLS = 6;
const MAX_INLINE_CHARS = 48_000;
/** Lean prompt: only top matches, never the full catalog */
const MAX_LEAN_SKILLS = 5;
const MAX_LEAN_DESC_CHARS = 100;

const GENERIC_SKILL_NAMES = ["write-unit-tests", "create-command", "create-query"];

export async function discoverSkillMeta(repoPath: string): Promise<RepoSkillMeta[]> {
  const skillsRoot = join(repoPath, SKILLS_DIR);
  let entries: import("node:fs").Dirent[];

  try {
    entries = await readdir(skillsRoot, { withFileTypes: true });
  } catch {
    return [];
  }

  const skills: RepoSkillMeta[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dirName = entry.name;
    const skillFile = join(skillsRoot, dirName, "SKILL.md");

    try {
      const head = await readFileHead(skillFile, 2048);
      const { name, description } = parseFrontmatter(head, dirName);
      skills.push({
        name,
        description: truncate(description, MAX_LEAN_DESC_CHARS),
        relativePath: `${SKILLS_DIR}/${dirName}/SKILL.md`,
        absolutePath: skillFile,
      });
    } catch {
      // skip dirs without SKILL.md
    }
  }

  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

async function readFileHead(path: string, bytes: number): Promise<string> {
  const handle = await open(path, "r");
  try {
    const buf = Buffer.alloc(bytes);
    const { bytesRead } = await handle.read(buf, 0, bytes, 0);
    return buf.subarray(0, bytesRead).toString("utf8");
  } finally {
    await handle.close();
  }
}

async function loadSkillContent(meta: RepoSkillMeta): Promise<RepoSkill> {
  const content = await readFile(meta.absolutePath, "utf8");
  return { ...meta, content };
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
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

export function rankSkillsForTicket(
  skills: RepoSkillMeta[],
  ticketText: string,
  limit: number,
  minScore = 0
): RepoSkillMeta[] {
  const text = ticketText.toLowerCase();

  const scored = skills.map((skill) => {
    let score = 0;
    const name = skill.name.toLowerCase();
    const desc = skill.description.toLowerCase();

    if (text.includes(name)) score += 10;
    if (text.includes(name.replace(/-/g, " "))) score += 8;
    if (text.includes(name.replace(/-module$/, ""))) score += 6;
    if (text.includes(name.replace(/-service$/, ""))) score += 6;

    for (const token of name.split("-")) {
      if (token.length >= 4 && text.includes(token)) score += 2;
    }

    for (const token of desc.split(/\W+/)) {
      if (token.length >= 5 && text.includes(token.toLowerCase())) score += 1;
    }

    const pathSegments = text.match(/v\d+\/[a-z0-9/_-]+/g) ?? [];
    for (const segment of pathSegments) {
      for (const part of segment.split("/")) {
        if (part.length >= 4 && name.includes(part)) score += 3;
      }
    }

    return { skill, score };
  });

  scored.sort((a, b) => b.score - a.score || a.skill.name.localeCompare(b.skill.name));

  const matched = scored
    .filter((s) => s.score > minScore)
    .map((s) => s.skill)
    .slice(0, limit);

  if (matched.length > 0) {
    return matched;
  }

  const generic = skills.filter((s) => GENERIC_SKILL_NAMES.includes(s.name));
  return generic.slice(0, Math.min(2, limit));
}

function formatSkillLine(skill: RepoSkillMeta): string {
  const desc = skill.description ? ` — ${skill.description}` : "";
  return `- \`${skill.relativePath}\`${desc}`;
}

export function buildLeanSkillsContext(priority: RepoSkillMeta[]): string {
  if (priority.length === 0) {
    return [
      "# Repo skills",
      "Read applicable files under `.cursor/skills/*/SKILL.md` in the **active repo** before editing.",
      "List that directory if you need to find a skill.",
    ].join("\n");
  }

  return [
    "# Repo skills (lean — active repo only, not inlined)",
    "Open only the paths below, or list `.cursor/skills/` in the active repo for more.",
    "",
    ...priority.map(formatSkillLine),
  ].join("\n");
}

export function buildFullSkillsContext(
  skills: RepoSkillMeta[],
  inlineSkills: RepoSkill[]
): string {
  if (skills.length === 0) {
    return "# Skills\nNo `.cursor/skills` in the active repo.";
  }

  const sections: string[] = [
    "# Skills (full mode — matched content inlined)",
    "",
    ...inlineSkills.flatMap((skill) => [
      `## ${skill.name}`,
      `Path: \`${skill.relativePath}\``,
      "",
      skill.content.trim(),
      "",
    ]),
  ];

  const inlined = new Set(inlineSkills.map((s) => s.name));
  const remaining = skills.filter((s) => !inlined.has(s.name));

  if (remaining.length > 0) {
    sections.push(
      "## Other skills (read from repo if needed)",
      ...remaining.slice(0, 10).map(formatSkillLine)
    );
  }

  return sections.join("\n");
}

export async function loadSkillsContext(
  repoPath: string,
  ticketText: string,
  mode: SkillsMode = "lean"
): Promise<string> {
  const skills = await discoverSkillMeta(repoPath);

  if (mode === "lean") {
    const ranked = rankSkillsForTicket(skills, ticketText, MAX_LEAN_SKILLS, 1);
    return buildLeanSkillsContext(ranked);
  }

  const ranked = rankSkillsForTicket(skills, ticketText, MAX_INLINE_SKILLS, 0);
  const inlineSkills = await Promise.all(ranked.map(loadSkillContent));
  return buildFullSkillsContext(skills, inlineSkills);
}

export function resolveSkillsMode(cli: { fullSkills: boolean }): SkillsMode {
  return cli.fullSkills ? "full" : "lean";
}
