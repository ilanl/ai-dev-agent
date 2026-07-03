---
name: ticket-solver-ship
description: "STRICT: use only if the message contains `apply to branch and MR AE-` plus digits. Branch/MR/GitLab MCP and Jira In Code Review after MR. Commit/push: user by default; if user explicitly allows agent commit/push, run git commit and git push (do not refuse). Requires `~/.ticket-solver-skill.env`. Read GitLab MCP schema before create_merge_request."
---

# Ticket solver — phase 3: Branch, push, MR, Jira

## When to use (strict)

Apply **only** when the message contains the literal sequence **`apply to branch and MR AE-`** followed by at least one digit (e.g. **`apply to branch and MR AE-1234`**).

Do **not** apply for paraphrases (“open MR for AE-123”, “ship AE-123”) without that exact **`apply to branch and MR AE-`** prefix.

## Preconditions (from context or restate)

- **`AE-<KEY>`** matches the ticket you are shipping.
- **Client / server** absolute roots (or `N/A`) and **scope** should already be known from phase 2; if not, ask for a short recap before running git/MR steps.
- **Merge bases** for `--client-base` / `--server-base` should match what was recorded in phase 2 (current branch at path collection), unless the user overrides with allowed values: client **`development`** | **`master`** | a **`release/*`** branch (exact name, e.g. `release/4.5.0`); server **`development`** | **`main`** | a **`release/*`** branch. There is no **`rc`** branch — release freezes use **`release/*`** only (see **`ticket-solver --help`** when CLI docs are updated).

## Strict rule

**Do not** create ticket branches, run **`ticket-solver --client-branch` / `--server-branch`**, or target MR work **until** the user has used **`apply to branch and MR AE-<KEY>`** (this skill).

## Commit and push (read first)

Two modes — pick one from the user's message or thread; **do not** tell the user commit/push is forbidden when mode B applies.

| Mode | Trigger | Agent action |
|------|---------|--------------|
| **A — user** | default; no explicit agent approval | After implementation, give commit subject(s) and ask the user to commit and push. |
| **B — agent** | user explicitly allows agent commit/push — same message or later in thread | **Run** `git add`, `git commit`, `git push` for ticket files/branches, then continue to MR. |

**Mode B triggers** (non-exhaustive): *"you commit and push"*, *"go ahead and push"*, *"agent commit and push"*, *"I allow you to commit and push"*, *"codex commit and push"*.

When mode B applies:
- That approval **is** the user's request to commit and push — satisfy commit-when-requested rules; **execute the commands**.
- Stage only this ticket's files; use agreed subjects (`fix(client): <slug> [KEY]` / `fix(server): <slug> [KEY]`).
- Push ticket branch(es) to `origin`; use standard git safety (no force-push to protected branches, no secrets).
- **Do not** refuse, defer to the user, or explain that the workflow forbids commit/push.

## What this phase does

1. **Branch naming**  
   - Shape: **`{GIT_USER_PREFIX}/{KEY}-{slug}`** from env + Jira slug rules (see CLI / prior JSON).  
   - Commit subject lines: **`fix(client): <slug> [KEY]`** / **`fix(server): <slug> [KEY]`** as applicable.

2. **Create ticket branches (CLI)**  
   After user confirms the **A–D style** plan (branches + bases), run only for repos that change:  
   **`ticket-solver <KEY> --client-branch <abs> --client-base <base>`** and/or **`--server-branch` + `--server-base`**.

3. **Implementation**  
   Apply fixes **on those branches only** — not on `development` / `main` / `master` / `release/*` unless the user explicitly opts in.

4. **Commit and push**  
   Follow **Commit and push** table above (mode A or B). Before MR, ensure the remote branch exists.

5. **MR (GitLab MCP, Agent)**  
   - Read MCP tool schema first.  
   - **`project_id`** from **`git -C <abs-root> remote get-url origin`**.  
   - **`title`**: **`Draft: `** + commit subject **verbatim**.  
   - **`source_branch`**: **`{user}/{KEY}-{slug}`**, **`target_branch`**: merge base from step 2.  
   - **Description**: Jira link, context, testing — not the title line.  
   - Assign MR to the developer who pushed when identifiable (`list_users` / `update_merge_request`).

6. **Jira status**  
   If the ticket **`AE-<KEY>`** is in context for this work, after MR(s) are created run:  
   **`ticket-solver --jira-code-review <KEY>`**  
   so the issue moves to **In Code Review** (same behavior as before).

## Boundaries

- MR creation: **GitLab MCP** `create_merge_request` only — not raw `ticket-solver` CLI.
- Reviewers: only if the user names them or team policy is documented elsewhere.

## CLI quick reference

| Need | Flag |
|------|------|
| Jira after MR | `--jira-code-review <KEY>` |
| Branches | `--client-branch` + `--client-base` / `--server-branch` + `--server-base` |

---

Config: `~/.ticket-solver-skill.env` only. **Ask mode:** no MCP — give MR fields for manual GitLab.
