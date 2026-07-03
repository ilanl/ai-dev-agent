---
name: ticket-solver-investigate
description: "STRICT: use only if the message contains `AE-` plus digits AND (`solve ticket AE-` OR `investigate AE-`). Opens Jira fetch only — no repo paths, no branch/MR, no code edits. Next step phrase for the user: `set paths AE-<same-key>`. Config `~/.ticket-solver-skill.env`. Agent: Coralogix MCP ok for links from Jira only in this phase as context for later."
---

# Ticket solver — phase 1: Investigate (Jira)

## When to use (strict)

Apply **only** when **both**:

1. The issue key appears: **`AE-`** + at least one digit (e.g. **`AE-1234`**).
2. The message contains **`solve ticket AE-`** *or* **`investigate AE-`** (same key).

Do **not** apply for: `fix AE-123`, `work on AE-123`, or keys without **`solve ticket`** / **`investigate`** as above.

## What this phase does

1. Run **`ticket-solver --get-jira <KEY>`** (global CLI on `PATH`; config only `~/.ticket-solver-skill.env`). Optionally **`--out`** if useful.
2. Present **structured output**: summary, comments, Coralogix URLs, **`suggestedBranch`** / workflow hints from JSON.
3. **Do not**: read/edit project code, run **`git`**, discover repos from cwd, create branches, or plan MRs.

## What this phase does not do

- **Paths** — deferred to phase 2 (**`set paths AE-<KEY>`**).
- **Implementation or shipping** — deferred to phase 3 (**`apply to branch and MR AE-<KEY>`**).

## Done when

- Jira JSON is fetched and summarized for the user.

## Next step (required)

End the turn by telling the user to continue with **exact wording**:

**`set paths AE-<KEY>`**

(use the same **`<KEY>`** as in this ticket, e.g. **`set paths AE-1234`**).

---

Reference: `ticket-solver --schema` / `--help`. Notion setup link may live on your team page.
