const ADF_TOKENS =
  /\b(doc|paragraph|text|strong|em|hardBreak|bulletList|orderedList|listItem|heading|link|blockquote|codeBlock|rule|mediaSingle|media|table|tableRow|tableCell|mention|emoji|status|expand|nestedExpand|panel|inlineCard|blockCard|date|placeholder)\b/gi;

const URL_PATTERN = /(https?:\/\/[^\s<>"']+)/g;

const FIELD_START =
  /(?:^|\s)([A-Za-z][A-Za-z0-9 /()'-]{1,50}):\s+/g;

export type JiraPlainBlock =
  | { type: "heading"; value: string }
  | { type: "field"; label: string; value: string }
  | { type: "line"; value: string };

const dedupeLine = (line: string): string => {
  let result = line.trim();
  if (!result) return result;

  if (result.length > 10 && result.length % 2 === 0) {
    const mid = result.length / 2;
    const first = result.slice(0, mid).trim();
    const second = result.slice(mid).trim();
    if (first === second) return first;
  }

  let prev = "";
  while (prev !== result) {
    prev = result;
    result = result.replace(/(.{8,}?)\s+\1(?=\s|$)/g, "$1");
  }

  return result;
};

const stripMarkdown = (text: string): string =>
  text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/#{1,6}\s*/g, "")
    .replace(/^\s*[-*]\s+/gm, "");

const isTableSeparator = (line: string): boolean =>
  /^\|?[\s:-]+\|[\s|:-]+$/.test(line);

const parseTableRow = (
  line: string,
): Array<{ label: string; value: string }> => {
  const cells = line
    .split("|")
    .map((cell) => cell.trim())
    .filter(Boolean);

  if (cells.length < 2) return [];

  const pairs: Array<{ label: string; value: string }> = [];
  for (let i = 0; i < cells.length - 1; i += 2) {
    const label = cells[i]?.replace(/:$/, "").trim();
    const value = cells[i + 1]?.trim();
    if (label && value) pairs.push({ label, value });
  }

  if (pairs.length) return pairs;

  if (cells.length === 2 && cells[0] && cells[1]) {
    return [{ label: cells[0].replace(/:$/, ""), value: cells[1] }];
  }

  return [];
};

const splitFields = (line: string): Array<{ label: string; value: string }> => {
  const matches = [...line.matchAll(FIELD_START)];
  if (!matches.length) return [];

  const fields: Array<{ label: string; value: string }> = [];

  for (let i = 0; i < matches.length; i += 1) {
    const match = matches[i];
    if (!match) continue;
    const label = match[1]?.trim();
    if (!label) continue;

    const valueStart = (match.index ?? 0) + match[0].length;
    const valueEnd =
      i + 1 < matches.length ? (matches[i + 1]?.index ?? line.length) : line.length;
    const value = line.slice(valueStart, valueEnd).trim();

    if (value) fields.push({ label, value });
  }

  return fields;
};

export const cleanJiraPlain = (raw: string): string => {
  let text = raw
    .replace(/\bhardBreak\b/gi, "\n")
    .replace(/\blink\s+(https?:\/\/\S+)/gi, "$1")
    .replace(ADF_TOKENS, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  text = stripMarkdown(text);

  text = text
    .split("\n")
    .map(dedupeLine)
    .join("\n")
    .replace(
      /([A-Za-z][A-Za-z0-9 /()'-]*?):\s*\1:\s*/g,
      "$1: ",
    );

  return text.trim();
};

export const parseJiraPlain = (raw: string): JiraPlainBlock[] => {
  const cleaned = cleanJiraPlain(raw);
  if (!cleaned) return [];

  const blocks: JiraPlainBlock[] = [];

  for (const rawLine of cleaned.split("\n")) {
    const line = rawLine.trim();
    if (!line || isTableSeparator(line)) continue;

    if (line.includes("|")) {
      const tableFields = parseTableRow(line);
      if (tableFields.length) {
        for (const field of tableFields) {
          blocks.push({ type: "field", label: field.label, value: field.value });
        }
        continue;
      }
    }

    const fields = splitFields(line);
    if (fields.length) {
      for (const field of fields) {
        blocks.push({ type: "field", label: field.label, value: field.value });
      }
      continue;
    }

    if (line.length < 80 && !line.includes("http") && /^[A-Z0-9][A-Za-z0-9 /()-]+$/.test(line)) {
      blocks.push({ type: "heading", value: line });
      continue;
    }

    blocks.push({ type: "line", value: line });
  }

  return blocks;
};

export const splitUrls = (
  value: string,
): Array<{ type: "text" | "url"; value: string }> => {
  const parts: Array<{ type: "text" | "url"; value: string }> = [];
  let lastIndex = 0;

  for (const match of value.matchAll(URL_PATTERN)) {
    const url = match[0];
    const index = match.index ?? 0;
    if (index > lastIndex) {
      parts.push({ type: "text", value: value.slice(lastIndex, index) });
    }
    parts.push({ type: "url", value: url });
    lastIndex = index + url.length;
  }

  if (lastIndex < value.length) {
    parts.push({ type: "text", value: value.slice(lastIndex) });
  }

  return parts.length ? parts : [{ type: "text", value }];
};
