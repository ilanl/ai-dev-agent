---
name: ticket-solver-ship
description: "STRICT: use only if the message contains `apply to branch and MR AE-` plus digits. Branch/MR/GitLab MCP and Jira In Code Review after MR; user commits and pushes. No branch work before this phrase. Requires `~/.ticket-solver-skill.env`. Read GitLab MCP schema before create_merge_request."
---

# Ticket solver — phase 3: Branch, push, MR, Jira

## When to use (strict)

Apply **only** when the message contains the literal sequence **`apply to branch and MR AE-`** followed by at least one digit (e.g. **`apply to branch and MR AE-1234`**).

Do **not** apply for paraphrases (“open MR for AE-123”, “ship AE-123”) without that exact **`apply to branch and MR AE-`** prefix.

## Preconditions (from context or restate)

- **`AE-<KEY>`** matches the ticket you are shipping.
- **Client / server** absolute roots (or `N/A`) and **scope** should already be known from phase 2; if not, ask for a short recap before running git/MR steps.
- **Merge bases** for `--client-base` / `--server-base` should match what was recorded in phase 2 (current branch at path collection), unless the user overrides with allowed values (`development` | `master` | `rc` for client; `development` | `main` | `rc` for server — see **`ticket-solver --help`**).

## Strict rule

**Do not** create ticket branches, run **`ticket-solver --client-branch` / `--server-branch`**, or target MR work **until** the user has used **`apply to branch and MR AE-<KEY>`** (this skill).

## What this phase does

1. **Branch naming**  
   - Shape: **`{GIT_USER_PREFIX}/{KEY}-{slug}`** from env + Jira slug rules (see CLI / prior JSON).  
   - Commit subject lines: **`fix(client): <slug> [KEY]`** / **`fix(server): <slug> [KEY]`** as applicable.

2. **Create ticket branches**  
   After user confirms the **A–D style** plan (branches + bases), run only for repos that change.

   **Default (main clone):**  
   **`ticket-solver <KEY> -y --client-branch <abs> --client-base <base>`** and/or **`--server-branch` + `--server-base`**.

   **Git worktree / detached HEAD (agent runtimes, isolated worktrees):**  
   When **`--client-branch` / `--server-branch`** points to a worktree that is already at the merge base — especially **detached HEAD** at the base commit — **do not** rely on `ticket-solver` checking out the base branch name inside that path. Git forbids the same branch in two worktrees (`fatal: 'development' is already used by worktree at '…'`).

   Instead:
   1. Use **`suggestedBranch`** from phase 1 (`ticket-solver --get-jira <KEY>` JSON) or from a prior successful explicit-branch run.
   2. Confirm HEAD is at the base:  
      `git -C <path> rev-parse HEAD` equals `git -C <path> rev-parse <base>`.
   3. Branch from current HEAD:  
      **`git -C <path> checkout -b <suggestedBranch>`**  
      (skip `git checkout <base>` and `git pull` in the worktree).
   4. **`--client-base` / `--server-base`** still name the **MR target branch** — not necessarily the branch checked out in the worktree path.

   **Agent does not** commit or push.

3. **Implementation**  
   Apply fixes **on those branches only** — not on `development` / `main` / `master` / `rc` unless the user explicitly opts in.

4. **User commits and pushes**  
   Remind the user to commit with the agreed subject(s) and push. Optionally confirm before MR creation that the remote branch exists.

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

## What this phase does not do

- **No** MR creation via raw `ticket-solver` CLI — use **GitLab MCP** `create_merge_request`.  
- **No** guessing GitLab reviewers unless the user names them or policy is documented elsewhere.

## CLI quick reference

| Need | Flag |
|------|------|
| Jira after MR | `--jira-code-review <KEY>` |
| Branches | `--client-branch` + `--client-base` / `--server-branch` + `--server-base` |

---

Config: `~/.ticket-solver-skill.env` only. **Ask mode:** no MCP — give MR fields for manual GitLab.
