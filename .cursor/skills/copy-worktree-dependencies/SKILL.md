---
name: copy-worktree-dependencies
description: Copies discovered .env* files from main agora-api-monorepo into git worktrees after git worktree add. Use when fixing missing worktree env, after creating a worktree, or when the user asks to copy or refresh worktree env files.
---

# Copy Worktree Dependencies

Git **`git worktree add` only checks out tracked files**. It does not include gitignored paths (`.env`, `.env.local`, etc.). Run the copy step after creating the worktree.

Prefer the repo script over hand-rolled `cp`:

[`scripts/worktree/copy-worktree-deps.mjs`](../../scripts/worktree/copy-worktree-deps.mjs)

```bash
node scripts/worktree/copy-worktree-deps.mjs --source <main-repo> --target <worktree> [--json]
```

Path helpers: [`scripts/worktree/resolve-paths.mjs`](../../scripts/worktree/resolve-paths.mjs)

## What it does

1. **Walk** the source monorepo from its root, skipping heavy dirs (`node_modules`, `.git`, `dist`, `.next`, `.nx`, `tmp`, `coverage`, etc.).
2. **Find** any file whose basename matches **`.env` + dot or end** (same idea as `grep` on names: `.env`, `.env.local`, `.env.development`, `.env.e2e`, … — not `.envrc`).
3. For each file, **copy** it into the worktree at the **same relative path** (regular files; existing symlinks at the target are replaced).

`tmp/`, `dist/`, and `.nx/` are **not** copied.

### node_modules

`create-worktree.mjs` installs deps via **`--deps-mode`**: **`pnpm-offline`**, **`pnpm`**, or **`none`**. On macOS/Linux, `setup-worktree-node-modules.mjs` loads **nvm** (when `NVM_DIR` / `~/.nvm/nvm.sh` exists), runs **`nvm use`** from the worktree `.nvmrc` or falls back to the main repo’s `.nvmrc`, then runs `pnpm install`. Windows runs `pnpm` on PATH only. See [git-worktrees-creator](../../agents/git-worktrees-creator.md).

## Preserve rule

If the target already has a **real** file or directory, **do not overwrite** — log `preserved`.

## Output

Each line: `copied`, `preserved`, or `skipped`. Summary counts at the end.

## Common workflows

**After create-worktree.mjs** — env copies run automatically; `node_modules` follows `--deps-mode` (see git-worktrees-creator agent).

**Manual run** (from main repo):

```bash
node scripts/worktree/copy-worktree-deps.mjs --source . --target ../agora-worktrees/WT-1
```

**All worktrees under a directory**:

```bash
MAIN="$(git rev-parse --show-toplevel)"
for wt in "$MAIN/../agora-worktrees"/*; do
  [ -d "$wt" ] || continue
  node "$MAIN/scripts/worktree/copy-worktree-deps.mjs" --source "$MAIN" --target "$wt"
done
```

## Safety

- Do not modify git config
- Do not overwrite existing real paths at the target
- Do not `git push` during worktree setup
