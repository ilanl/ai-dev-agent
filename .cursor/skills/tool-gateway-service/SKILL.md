---
name: tool-gateway-service
description: Tool Gateway Service domain expert. Tool catalog, Composio OAuth connections, connector adapters, built-in tools, trigger system (Composio webhooks → Temporal), policy engine. Use when working in apps/services/tool-gateway-service/ or with tool invocation, connections, or trigger features.
---

# Tool Gateway Service

NestJS microservice that brokers tool execution for Studio agents.

## Key Responsibilities

- **Connector OAuth** — authorize, complete, and revoke Composio connections for users
- **Tool invocation** — route `invoke-tool` requests through the `AdapterRegistry` (SDK adapter or Connector adapter)
- **Composio session tools** — serialize per-user Composio tool-router session into LangChain tool descriptors
- **Trigger system** — ingest Composio webhooks, dispatch to Temporal workflows
- **Policy engine** — enforce per-tool risk policies before invocation

## Architecture

```text
src/
├── api/controllers/       # REST endpoints (connections, tools, composio, triggers...)
├── application/           # CQRS commands/queries grouped by feature
│   ├── connections/
│   ├── composio/
│   ├── tools/
│   ├── trigger-events/
│   ├── trigger-sources/
│   ├── trigger-presets/
│   └── trigger-subscriptions/
├── domain/
│   ├── connectors/        # ConnectorDefinition files (gmail, outlook, hubspot, etc.)
│   ├── composio/          # Composio domain helpers (jwt, tool-router meta slugs)
│   ├── catalog/           # Built-in tool definitions (CRM, documents, etc.)
│   ├── entities/          # Sequelize entities
│   ├── policy/            # Tool risk policies per connector
│   ├── services/          # ConnectorRegistry, PolicyEngine, ToolCatalog, etc.
│   └── triggers/          # Trigger route constants, event name helpers
└── infra/
    ├── adapters/          # SdkAdapter (built-in Agora tools), ConnectorAdapter (Composio)
    ├── services/          # ComposioService, AuditEmitterService, IdempotencyStore
    ├── sdk-bridge/        # Agora HTTP client SDK wrappers (CRM, invest, documents, etc.)
    └── env/config/        # Config, COMPOSIO_API_KEY, DEV_DEFAULT_COMPOSIO_AUTH_CONFIGS
```

## Composio Integration

- `ComposioService` wraps `@composio/core` SDK — sessions, authorize, execute, triggers
- Each connector (`ConnectorDefinition`) maps to a Composio toolkit via `composioToolkitSlug`
- `DEV_DEFAULT_COMPOSIO_AUTH_CONFIGS` in `config.ts` maps toolkit slugs → auth config IDs (dev only)
- `CONNECTED_ACCOUNT_PROFILE_RESOLVERS` in `composio.service.ts` resolves connected account email post-OAuth

## Related Skills

- **[add-composio-toolkit](../add-composio-toolkit/SKILL.md)** — add or update Composio toolkits, including connector tools and curated trigger presets
- **[audit-composio-toolkits](../audit-composio-toolkits/SKILL.md)** — audit connector tool and trigger preset slugs/descriptions against live Composio API, apply corrections
- **[create-service-feature](../create-service-feature/SKILL.md)** — add new commands/queries/endpoints to this service
- **[write-unit-tests](../write-unit-tests/SKILL.md)** — write tests for handlers and validators

## E2E Tests

### Structure

```text
e2e/
├── vitest.e2e.config.mts    # Vitest config (globals: true, 60s timeout, no parallelism)
├── src/
│   ├── flows/               # ALL specs grouped by domain
│   │   ├── connections/      # OAuth lifecycle, isolation
│   │   ├── connectors/       # Connector catalog browsing
│   │   ├── tools/            # Catalog, invoke, auth boundaries
│   │   ├── composio/         # Session tools, tenant boundary, webhooks
│   │   ├── triggers/         # Presets, events, actor reads, isolation
│   │   ├── security/         # Cross-cutting auth (protected routes, API key, cross-tenant)
│   │   └── health/           # Health + metrics endpoints
│   ├── clients/              # HTTP clients + route constants
│   │   ├── gateway.client.ts # TestContext class — authenticated HTTP with tenant+actor headers
│   │   ├── http.client.ts    # e2eRequest, tenantHeaders, apiUrl helpers
│   │   └── routes/           # Route path constants per controller domain
│   ├── factories/            # Builders that create test data
│   │   ├── identity.factory.ts    # buildIdentitySet, signE2EActorToken, actorHeaders
│   │   └── connection.factory.ts  # buildConnectionBody, buildSandboxInvokeBody
│   ├── fixtures/             # Static types + registry-based expectations
│   │   ├── types.ts               # IConnectionResponse, IInvokeToolBody, etc.
│   │   └── connectors-catalog.ts  # Registry-based connector expectations
│   ├── helpers/              # Assertions + misc utilities
│   │   ├── expect-shapes.ts  # Shape assertion helpers (tool, connector, connection, preset)
│   │   ├── expect-http.ts    # HTTP error assertion helpers
│   │   └── e2e-route-ids.ts  # Stable test IDs (slugs, keys, preset IDs)
│   ├── config/               # Environment + execution mode
│   │   ├── env.ts            # loadEnv — E2E environment config
│   │   ├── load-dotenv.ts    # .env file loading
│   │   └── execution-mode.ts # local vs against-deployed
│   └── setup/
│       ├── global-setup.ts   # Readiness probe for local service (port 9010)
│       └── setup-file.ts     # Initializes SDK client with base URL
```

### Spec naming

- `*.e2e.spec.ts` under `flows/<domain>/` (e.g. `catalog-browse-tools.e2e.spec.ts`, `invoke-tool-idempotency.e2e.spec.ts`)
- Stateful flows: `describeStateful` + `allowStatefulTests`
- Optional env gates: `ACTOR_TOKEN_SECRET`, `enableComposioT3` (webhook signature tests)

### Key Environment Variables

- `TOOL_GATEWAY_E2E_EXECUTION_MODE` — `local` (default) or `against-deployed`
- `TOOL_GATEWAY_E2E_BASE_URL` — service URL (default: `http://localhost:9010`)
- `ACTOR_TOKEN_SECRET` — required for actor-authenticated tests (update, revoke, audit)
- `TOOL_GATEWAY_INTERNAL_API_KEY` — required for internal API key tests
- `TOOL_GATEWAY_E2E_ALLOW_STATEFUL` — enables stateful tests in non-local mode

### Running

```bash
# All tests
nx run tool-gateway-service:e2e

# Subset (vitest passthrough)
nx run tool-gateway-service:e2e -- --testPathPattern=flows/security
```

### Writing New Tests

- Use `TestContext` from `clients/gateway.client` for authenticated requests
- Always import vitest globals explicitly: `import { describe, it, expect } from 'vitest'`
- Use `loadEnv().allowStatefulTests ? describe : describe.skip` for stateful tests
- Use `hasActorTokenSecret()` guard for actor-dependent operations
- Add route constants to `clients/routes/` per controller domain
- Add reusable shape assertions to `helpers/expect-shapes.ts`
- Add builder functions to `factories/` and interfaces to `fixtures/types.ts`
- Place new specs in `flows/<domain>/` grouped by feature area
