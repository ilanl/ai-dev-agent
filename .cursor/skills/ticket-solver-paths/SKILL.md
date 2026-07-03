---
name: ticket-solver-paths
description: "STRICT: `AE-` plus digits AND (`set paths AE-` OR `client:` OR `server:` with absolute git root). Paths, scope, merge base from current branch; Coralogix MCP if links in context. No `--*-branch`/MR until phase 3. Next: `apply to branch and MR AE-<key>`."
---

# Ticket solver — phase 2: Paths & investigation

## When to use (strict)

Apply **only** when **both**:

1. **`AE-`** + at least one digit appears (e.g. **`AE-1234`**).
2. **Any** of:
   - **`set paths AE-`** + digits, or  
   - **`client:`** and/or **`server:`** with **absolute** git roots (and **`AE-…`** appears in the same message **or** the active **`AE-…`** key is explicit in thread context).

If the user only says “consider path1” / “look at …” **without** **`AE-…`** and without **`set paths`**, do **not** use this skill unless chat context already established the issue key **and** the user is clearly supplying roots — prefer asking them to include **`set paths AE-<KEY>`**.

## What this phase does

1. **Paths (required before any repo work)**  
   - **Client:** absolute git root or **`N/A`**.  
   - **Server:** absolute git root or **`N/A`**.  
   Accept explicit forms such as **`client: /abs/path`**, **`server: /abs/path`**, or prose + paths, as long as absolutes are unambiguous.

2. **Merge base from git (for later branch commands)**  
   For each non-`N/A` root, record **`git -C <root> rev-parse --abbrev-ref HEAD`** (or equivalent) as the **current branch** to use as **`--client-base` / `--server-base`** when phase 3 runs **`ticket-solver`** branch creation — **unless** the user names a different allowed base:
   - **Client:** **`development`** | **`master`** | a **`release/*`** branch (exact name, e.g. `release/4.5.0`).
   - **Server:** **`development`** | **`main`** | a **`release/*`** branch (exact name).
   - **No `rc` branch** — release freezes use **`release/*`** only. Pass the full release branch name to **`--client-base`** / **`--server-base`**.

3. **Scope**  
   User confirms **client** / **server** / **both** for the eventual fix (may differ from where the bug was found).

4. **Investigation**  
   - Read/analyze code only under declared roots (not workspace cwd as implicit root).  
   - If **Coralogix links** exist in **thread or Jira context** from phase 1: in **Agent**, use Coralogix MCP (`read_dataprime_intro_docs` before heavy queries).  
   - If **no** Coralogix links: ask what to investigate next; narrow with the user until there is a concrete plan.

5. **Discussion** until there is a **clear resolution plan** (what to change, where). Still **no** implementation if it implies creating the ticket branch — implementation that belongs on a feature branch waits until phase 3 is triggered.

## What this phase does not do

- **No** `ticket-solver --client-branch` / `--server-branch` **yet** (that is phase 3).
- **No** checkout of **`{user}/{KEY}-…`** branches until the user sends **`apply to branch and MR AE-<KEY>`**.
- **No** MR or GitLab MCP for shipping in this phase.
- **No** `git commit` / `git push` in this phase — phase 3 handles that (user default, or agent when user explicitly allows; see **`ticket-solver-ship`**).

## Done when

- Paths and scope are set, merge bases noted, and investigation plan is agreed (or clearly blocked on user input).

## Next step (required)

When the user is ready to **create the ticket branch, commit workflow, push, MR**, end with **exact wording**:

**`apply to branch and MR AE-<KEY>`**

Example: **`apply to branch and MR AE-1234`**.  
For agent commit/push in phase 3, add e.g. **`— you commit and push`** to that message.

---

Config: `~/.ticket-solver-skill.env` only for Jira CLI.  
