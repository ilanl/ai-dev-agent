export const formatTime = (iso: string | null): string => {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const promptIssueKey = (): string | null => {
  const issueKey = window.prompt("Enter Jira issue key (e.g. AE-1234)");
  if (!issueKey?.trim()) return null;
  return issueKey.trim().toUpperCase();
};

export const authorInitials = (name: string | null | undefined): string =>
  (name ?? "?").slice(0, 2).toUpperCase();
