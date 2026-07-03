---
name: module-configuration-provider
description: >-
  Replaces process.env and ad-hoc configuration in Agora API domain modules under
  libs/modules/** with the module's *ConfigProvider-style provider (env and tenant
  config schemas). Use only for libs/modules/** configuration work.
---

# Module configuration (libs/modules)

## When to use this skill

Use this skill immediately when any of the following is true:

- You are adding, changing, or reading config in Agora API modules (`libs/modules/**`).
- You see `process.env` or raw `ConfigService.get(...)` usage in an Agora API module.
- You need to migrate existing config access to module `IConfigKey` / `IConfig`.
- The user asks to make a module multi-tenant ready configuration-wise.
- You are initializing any provider/component that depends on module config values.
- You need tenant-aware config (`config.forTenant(tenantId)`).

Do not use this skill for `apps/**`, `apps/services/**`, `libs/packages/**`, `libs/agora-api-libs/**`, SDKs, tools, or other monorepo areas. Those surfaces have their own configuration patterns.

Do not wait to "clean up later" - apply this pattern as part of the same change.

## Canonical documentation

Most configuration guidance now lives in Agora API docs:

- `apps/agora-api/docs/configs/configuration-overview.md`
- `apps/agora-api/docs/configs/setup-module-configuration-provider.md` — one-time `infra/config/` scaffolding, validation, and ESLint enforcement.
- `apps/agora-api/docs/configs/migrate-legacy-module-configuration.md` — temporary guide for legacy `dotenv` / `envConfig` / raw `ConfigService` migrations.
- `apps/agora-api/docs/configs/use-module-configuration-provider.md` — adding/changing/reading config keys in an already-set-up module.
- `apps/agora-api/docs/configs/configuration-implementation-details.md`

Use those documents as the source of truth for:

- file layout and scaffolding;
- provider/module/schema patterns;
- env vs tenant decision rules;
- fallback and startup behavior;
- tenant-conf-service and `agora-api-infra` implementation details.

## Skill usage note

When using this skill in coding tasks, keep the "when to use" checks above, and follow the Agora API docs listed in this file for implementation details. The skill should route the task to the docs; avoid duplicating long implementation guidance here.
