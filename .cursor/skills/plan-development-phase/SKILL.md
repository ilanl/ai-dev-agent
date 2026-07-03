---
name: plan-development-phase
description: >-
  Plan and execute a numbered development phase from the studio-backend
  development plan. Reads the phase plan.md, explores codebase state,
  resolves referenced research docs, and produces a concrete implementation
  plan with todos. Use when the user references a phase folder under
  apps/studio-backend/docs/development-plan/, development-plan-p2/, or
  development-plan-p3/, or says "let's build phase NN".
---

# Plan a Development Phase

## When to use

The user references a phase plan folder or says something like:
- "let's build phase 03"
- "implement `apps/studio-backend/docs/development-plan/05-tool-gateway/`"
- "build the next phase"

## Workflow

### 1. Read the phase plan

Read `plan.md` from the referenced phase folder. Identify:
- **Goal** and **Dependencies** (skip if deps are incomplete -- warn the user)
- **Numbered tasks** (`NN.M` format)
- **Deliverables checklist**
- **Related links** (research design docs, other phases)

### 2. Read progress tracker

Read `apps/studio-backend/docs/PROGRESS.md` to understand:
- Which phases are already complete
- Whether this phase's prerequisites are met
- Current task statuses within this phase (if partially started)

### 3. Explore current codebase state

Launch parallel explore agents to understand what already exists and what patterns to follow:

**Agent A -- Target area**: Check whether the files/directories the plan will create already exist. Read any that do.

**Agent B -- Patterns**: Find existing examples of the same kind of artifact the phase creates (entities, commands, controllers, migrations, services). Read 1-2 representative files to extract the pattern.

**Agent C -- Research docs**: Read every research design doc linked in the plan's **Related** section. Extract all TypeScript type definitions, interfaces, enums, constants, and code patterns that the phase references.

### 4. Resolve dependencies

For each task in the plan, check:
- Referenced files/modules -- do they exist?
- Referenced types/contracts -- are they importable?
- Referenced config (tsconfig paths, NX project.json, package.json) -- is it in place?

Flag any missing prerequisites for the user.

### 5. Create the implementation plan

Switch to **Plan mode** and produce a plan with:

**Structure** (one section per `NN.M` task):
- What to create/modify (specific file paths)
- Key code snippets for non-obvious implementations
- Which existing patterns to follow (cite the file you read in step 3)

**Todos** (one per logical unit of work):
- Use the task IDs from the plan (`NN.M`) as prefixes
- Keep each todo atomic enough to complete and verify independently
- Include a final todo to update `PROGRESS.md`

**PROGRESS.md update** (always the last todo):
- Mark all tasks `[x]`
- Mark the phase header `[x]`
- Check off deliverables
- Update the summary table counts

### 6. Execute

After user confirms the plan, execute todos sequentially:
- Mark each todo `in_progress` before starting, `completed` when done
- Run `ReadLints` after substantive edits
- Follow all conventions from `.cursor/rules/conventions.mdc`

## Conventions to follow

- **Task IDs**: `NN.M` (phase.subtask) -- keep aligned with plan.md and PROGRESS.md
- **File naming**: `kebab-case` for files, `PascalCase` for classes
- **Interfaces**: prefix with `I` (e.g. `IModelProvider`) per ESLint rule
- **Imports**: `import type` for type-only imports; relative imports within a package
- **NX packages**: follow `libs/packages/common/` structure (package.json, tsconfig.json extending `tsconfig.package.json`, project.json with `@nx/js:tsc`)
- **NX apps**: follow `apps/services/auth-service/` structure (webpack build, project.json with nx:run-commands)
- **Entities**: in `libs/packages/daos/` with interface, Symbol key, provider registration
- **Migrations**: Sequelize CLI JS files in `db/migrations/` with RLS pattern (see Phase 00 plan)
- **CQRS**: command/query class + handler in dedicated folder, registered as provider
- **Tests**: Vitest with in-memory SQLite (`memDb`), mock external deps only
