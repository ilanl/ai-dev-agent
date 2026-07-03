---
name: add-composio-toolkit
description: Add or update a Composio toolkit in apps/services/tool-gateway-service, including connector tools and curated trigger presets. Use when the user asks to add a Composio toolkit, connector, tools, or triggers to Tool Gateway.
---

# Add Composio Toolkit

Use this skill when adding or updating a Composio-backed connector in `apps/services/tool-gateway-service`.

## Required Context

Read these first:

- `.cursor/skills/tool-gateway-service/SKILL.md`
- `.cursor/skills/audit-composio-toolkits/SKILL.md`
- `apps/services/tool-gateway-service/src/domain/composio/composio.types.ts`
- `apps/services/tool-gateway-service/src/domain/composio/toolkits/` (existing snapshots)
- `apps/services/tool-gateway-service/src/domain/connectors/` (connector definitions)
- `apps/services/tool-gateway-service/scripts/audit-composio-curated.ts`

## Intake

The user should provide the connector they want, for example `slack`, `notion`, or `typeform`.

1. If the connector is missing or ambiguous, ask which connector to add before doing live discovery.
2. Ask which toolkit version to use when the user cares about pinning (Composio toolkit page → version). If they say “all tools,” discover the live toolkit version from Composio docs or API and pin it on the toolkit file.
3. Ask which group of tools/triggers to add: `read`, `write`, or `both`. Default to **all tools** only when the user explicitly asks for the full toolkit.
4. Treat `write` as including write and destructive operations only when the user explicitly accepts destructive tools.
5. Ask separately whether trigger presets are needed when the user does not mention triggers.

Never change an existing toolkit's pinned `version` without explicit user approval. If the requested work appears to require a different version, stop and ask how to proceed.

## Composio Discovery

Use Composio's API/SDK to discover the live catalog before editing code:

1. Get `COMPOSIO_API_KEY` from `apps/services/tool-gateway-service/.env` when possible.
2. If the `.env` file is unavailable or does not contain `COMPOSIO_API_KEY`, ask the user for the API key.
3. Prefer the REST API for bulk discovery (faster than ad-hoc SDK scripts):

```bash
# From apps/services/tool-gateway-service with .env loaded
curl -sS -H "x-api-key: $COMPOSIO_API_KEY" \
  "https://backend.composio.dev/api/v3/tools?toolkit_slug=<slug>&limit=2000"
curl -sS -H "x-api-key: $COMPOSIO_API_KEY" \
  "https://backend.composio.dev/api/v3/toolkits/<slug>"
```

4. Confirm toolkit slug (usually lowercase, e.g. `typeform`, `googlesheets`) and pinned version (e.g. `20260506_00` from [Composio toolkit docs](https://docs.composio.dev/toolkits)).
5. Fetch all tools for the toolkit; capture exact slugs and display names.
6. Fetch trigger types when adding triggers (`composio.triggers.getType` / triggers list API).
7. Filter by requested group: `read`, `write`, or `both`. Classify destructive tools (`DELETE_*`, permanent removal) as `destructive`.
8. Do not invent slugs or versions — use API/docs values exactly.

Live audit script (after edits):

```bash
pnpm exec tsx --tsconfig tsconfig.base.json \
  apps/services/tool-gateway-service/scripts/audit-composio-curated.ts
```

## File Placement

### Toolkit snapshot (vendor catalog + Studio metadata)

`apps/services/tool-gateway-service/src/domain/composio/toolkits/{name}.toolkit.ts`

```typescript
import type { ComposioToolkit } from '../composio.types';

export const exampleToolkit = {
  slug: 'example',           // Composio toolkit slug (lowercase)
  version: '20260506_00',    // Pinned Composio toolkit sync version
  tools: [
    {
      slug: 'EXAMPLE_DO_THING',
      studioName: 'Do thing',           // Short Studio-facing label
      studioRiskLevel: 'read',          // read | write | destructive
    },
  ],
  triggers: [
    {
      slug: 'EXAMPLE_NEW_ITEM',
      triggerConfig: {},
      studioEventName: 'external.example_item.created',
    },
  ],
} as const satisfies ComposioToolkit;
```

Register in `apps/services/tool-gateway-service/src/domain/composio/toolkits/index.ts`:

- `export { exampleToolkit } from './example.toolkit'`
- Add to `allComposioToolkits` (powers `allToolkitVersionsMap` and `toolSlugToVersionMap`)

### Connector definition (product-facing)

`apps/services/tool-gateway-service/src/domain/connectors/{connector-slug}.connector.ts`

```typescript
import type { ComposioConnectorDefinition } from '@agorareal/agents-contracts';

import { exampleToolkit } from '../composio';

export const exampleConnector = {
  connectorType: 'composio',
  slug: 'example',
  name: 'Example',
  description: 'Short user-facing connector description.',
  category: 'other', // 'google' | 'microsoft' | 'other'
  provider: 'example',
  composioToolkitSlug: exampleToolkit.slug,
  composioToolkitVersion: exampleToolkit.version,
  requiredScopes: [],
  tools: exampleToolkit.tools.map((t) => ({
    slug: t.slug,
    name: t.studioName,
    riskLevel: t.studioRiskLevel,
  })),
  triggers: exampleToolkit.triggers.map((tr) => ({
    slug: tr.slug,
    triggerConfig:
      typeof tr.triggerConfig === 'function' ? tr.triggerConfig() : tr.triggerConfig,
    eventName: tr.studioEventName,
  })),
} as const satisfies ComposioConnectorDefinition;
```

Register in `apps/services/tool-gateway-service/src/domain/connectors/index.ts` → `allConnectors`.

### What is NOT separate anymore

- No `connectors.registry.ts` — use `connectors/index.ts` (`allConnectors`).
- No `trigger-preset-registry.ts` — curated triggers live on the toolkit `triggers` array and flow through the connector.
- No per-tool object map on the connector — tools are mapped from the toolkit array.
- Catalog tool keys (`connector.{slug}.{COMPOSIO_SLUG}`) and trigger catalog rows are derived from `allConnectors` automatically.

## Risk Levels

Assign `studioRiskLevel` on each toolkit tool row:

| Level | When |
| --- | --- |
| `read` | `GET_*`, `LIST_*`, search/fetch only |
| `write` | create, update, patch, upload, send |
| `destructive` | delete, revoke, permanent removal |

## Triggers

- Composio toolkit may expose zero triggers (e.g. Typeform) — use `triggers: []`.
- When triggers exist, set `studioEventName` to `external.<domain>.<event>` (see `triggers/triggers.constants.ts` for shared names).
- `triggerConfig` may be `{}` or a function when preset defaults need runtime values (see `hubspot.toolkit.ts`).
- Triggers with required user-specific config should not be added until product defines defaults.

## Post-Registration

1. **Connected account profile** (optional but recommended): add a resolver in `src/infra/services/composio.service.utils.ts` → `CONNECTED_ACCOUNT_PROFILE_RESOLVERS` using a read tool that returns email/display name after OAuth.
2. **Dev auth config** (local only): add `typeform: 'ac_...'` to `DEV_DEFAULT_COMPOSIO_AUTH_CONFIGS` in `src/infra/env/config/config.ts` after creating the Composio auth config in the dashboard (keys must match toolkit slug).
3. **Production**: insert row in `composio_auth_configs` or set `COMPOSIO_AUTH_CONFIGS` env JSON.

## Validation

After edits:

- `ReadLints` on changed files.
- Run `audit-composio-curated.ts` (requires `COMPOSIO_API_KEY`).
- Do not edit generated `client-sdk` folders.

## Contracts

- Connector types: `@agorareal/agents-contracts` (`ComposioConnectorDefinition`, `ConnectorCategory`).
- Toolkit types: `domain/composio/composio.types.ts` (`ComposioToolkit`, `ComposioTool`, `ComposioTrigger`).
