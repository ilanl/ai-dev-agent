export const TICKET_URL_PARAM = "ticket";

const normalizeIssueKey = (issueKey: string): string =>
  issueKey.trim().toUpperCase();

export const readTicketFromUrl = (): string | null => {
  const ticket = new URLSearchParams(window.location.search).get(
    TICKET_URL_PARAM,
  );
  if (!ticket?.trim()) return null;
  return normalizeIssueKey(ticket);
};

export const writeTicketToUrl = (
  issueKey: string | null,
  mode: "push" | "replace" = "replace",
): void => {
  const url = new URL(window.location.href);
  if (issueKey) {
    url.searchParams.set(TICKET_URL_PARAM, normalizeIssueKey(issueKey));
  } else {
    url.searchParams.delete(TICKET_URL_PARAM);
  }

  if (mode === "push") {
    window.history.pushState(null, "", url);
    return;
  }

  window.history.replaceState(null, "", url);
};
