const DEFAULT_MAX_CANDIDATES = 12;
const GIT_BRANCH_MAX_LEN = 255;

export type BranchCandidateOptions = {
  agentId?: string;
  issueKey?: string;
  maxCandidates?: number;
};

export const appendBranchSuffix = (base: string, suffix: string): string => {
  const part = `-${suffix}`;
  if (base.length + part.length <= GIT_BRANCH_MAX_LEN) return `${base}${part}`;
  return `${base.slice(0, GIT_BRANCH_MAX_LEN - part.length)}${part}`;
};

export const generateBranchCandidates = (
  preferred: string,
  options: BranchCandidateOptions = {},
): string[] => {
  const max = options.maxCandidates ?? DEFAULT_MAX_CANDIDATES;
  const base = preferred.trim();
  const candidates: string[] = [];

  const push = (name: string) => {
    const trimmed = name.trim();
    if (trimmed && !candidates.includes(trimmed)) candidates.push(trimmed);
  };

  push(base);

  if (options.agentId) {
    push(appendBranchSuffix(base, options.agentId));
  }

  if (options.issueKey) {
    const key = options.issueKey.toUpperCase();
    push(appendBranchSuffix(base, key));
    const digits = key.match(/(\d+)$/)?.[1];
    if (digits) push(appendBranchSuffix(base, digits));
  }

  for (let i = 2; candidates.length < max; i++) {
    push(appendBranchSuffix(base, String(i)));
  }

  return candidates.slice(0, max);
};

export const isBranchNameTakenError = (error: string): boolean => {
  const lower = error.toLowerCase();
  return (
    lower.includes("already exists") ||
    (lower.includes("cannot create") && lower.includes("branch")) ||
    lower.includes("a branch named")
  );
};
