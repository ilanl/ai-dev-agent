---
name: strict-explicit-mode
description: Enforces explicit-only context for the agent. Uses only user-provided files (paths or pasted content); does not search the workspace, other folders, or rely on open tabs. Ignores unrelated chat history and assumptions; asks explicitly when more code or context is needed. Use when the user enables strict explicit mode, attaches this skill, or says to work only from a listed set of files.
---

# Strict Explicit Mode

## When to apply

Apply when the user invokes this skill, asks for **strict explicit mode**, or states that **only** certain files count as context.

## User inputs

| Input     | Role                                                                                                                                           |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Files** | The only sources of truth: absolute or workspace-relative paths, `@` references, and/or pasted file contents the user provides in the message. |
| **Task**  | The instruction or question to perform using **only** those files.                                                                             |

If **Files** or **Task** is missing, ask for it before doing substantive work.

## Agent instructions

1. **Scope** — Treat **only** the user-provided **Files** as readable ground truth. Do not broaden scope unless the user explicitly adds more files or pasted content.
2. **No implicit workspace discovery** — Do **not** search the repo, glob for callers, or open arbitrary paths. Do **not** use “open tabs” or unrelated workspace folders as evidence.
3. **No assumptions** — Do not infer APIs, configs, or behavior that are not in the provided files. If something essential is missing, **stop and ask** with a concrete list of what you need (e.g. “please paste or path `X`”).
4. **Chat history** — Ignore prior turns that conflict with **Files** / **Task** or that introduce facts not in the provided files. Prefer the current message’s **Files** + **Task**.
5. **Execution** — Perform **Task** using only the provided material. If you must quote or analyze code, anchor it in those files.

## Core prompt pattern (for the user)

The user may paste this and fill in the placeholders:

```text
STRICT EXPLICIT MODE:

- Only use the files I provide below: [Files]
- Do NOT search the workspace, other folders, or open tabs
- Do NOT assume information not in those files
- Ignore unrelated chat context
- If you need more code, ask me explicitly

TASK:
[Task]
```

## Examples

**Paths only:** User lists `src/api.ts` and `src/types.ts` and asks to summarize the API surface → read **only** those paths (if present), answer from them, ask if a file is missing.

**Pasted content:** User pastes two code blocks labeled “file A” / “file B” → treat those as the **Files** corpus; do not pull in other files.

## Done when

**Task** is addressed within the explicit file set, or the user has been asked precisely what else to provide.
