---
name: e2e-testing
description: >-
  Author black-box HTTP end-to-end tests (Vitest, axios, optional client SDK).
  Use when the user asks for e2e tests, integration tests against a running service,
  flows specs, TestContext, SdkGateway, tenant or auth boundary tests, or extending
  an apps/services/*/e2e harness.
---

# E2E testing (black-box HTTP)

End-to-end tests hit a **running** service over HTTP. They do **not** import Nest modules, boot the app in-process, or mock the primary domain persistence layer unless an existing suite already does.

**Reference implementation:** `apps/services/tool-gateway-service/e2e/` — follow its layout and conventions when adding tests there or cloning the pattern for another service.

**Do not run tests** unless the user asks. After changes, give the `nx run <service>:e2e` command (and optional `--testPathPattern=...`) for them to run locally.

---

## Before writing anything

1. **Locate the service e2e package** — usually `apps/services/<service-name>/e2e/` or `apps/<app>/e2e/`. Read its `README.md` and `vitest.e2e.config.mts` (or Jest equivalent).
2. **Read the controller** for the feature — map HTTP method, path, auth guards, and DTOs from OpenAPI / `*Client` in the generated SDK.
3. **Search existing specs** under `flows/` for the same domain — extend or mirror; avoid duplicating security coverage.
4. **Check `clients/gateway.sdk.ts`** (or equivalent) — if the endpoint is already wrapped, use `ctx.sdk`; do not add raw HTTP for happy paths.
5. **Never edit generated `client-sdk/`** — consume `@agorareal/<service>-client-sdk`; extend `SdkGateway` instead.

---

## Directory layout (tool-gateway pattern)

```text
e2e/
├── vitest.e2e.config.mts      # include: ['**/*.e2e.spec.ts'], globalSetup, setupFiles
├── README.md                    # env vars, run commands
├── flows/                       # specs only — grouped by domain
│   ├── <domain>/                # connections, tools, composio, triggers, security, health
│   │   └── <feature>.e2e.spec.ts
├── clients/
│   ├── http.client.ts           # e2eRequest, tenantHeaders, apiUrl, SERVICE_PREFIX
│   ├── gateway.client.ts        # TestContext — get/post/put/del + auth
│   ├── gateway.sdk.ts           # SdkGateway — typed SDK + auth interceptor
│   ├── gateway.types.ts         # list-query types and defaults
│   ├── sdk-session.ts           # withSdkAuth / axios interceptor
│   ├── routes/                  # path constants per controller (toolGatewayRoutes)
│   └── index.ts                 # barrel — export only what specs need
├── config/                      # loadEnv, execution-mode, dotenv
├── factories/                   # builders (invoke body, connection, identity)
├── fixtures/                    # re-export domain registries; barrel index
├── helpers/                     # expect-http, expect-shapes, domain helpers
│   └── index.ts
└── setup/
    ├── global-setup.ts          # readiness probe (local)
    └── setup-file.ts            # init SDK axios + OpenAPI.BASE
```

**Barrels:** each folder has `index.ts` exporting only symbols used outside that folder. Specs import from `../../clients`, `../../fixtures`, `../../helpers`, `../../factories`, `../../config` — not deep paths into sibling modules.

---

## Spec naming and placement

| Rule                 | Example                                              |
| -------------------- | ---------------------------------------------------- |
| Suffix               | `*.e2e.spec.ts` only (no `t1`/`t2` tier in filename) |
| Location             | `flows/<domain>/<descriptive-name>.e2e.spec.ts`      |
| Describe             | `flow: <user-visible behavior>` or domain name       |
| One concern per file | browse catalog vs invoke policy vs tenant isolation  |

---

## Two HTTP styles (use both deliberately)

### 1. Happy path — `TestContext` + `SdkGateway`

```typescript
import { beforeAll, describe, expect, it } from 'vitest';
import { buildTestContext, type TestContext } from '../../clients';

describe('flow: browse tools', () => {
  let ctx: TestContext;

  beforeAll(() => {
    ctx = buildTestContext().ctx;
  });

  it('lists catalog tools', async () => {
    const { tools } = await ctx.sdk.catalog.listTools();
    expect(tools.length).toBeGreaterThan(0);
  });
});
```

- SDK calls throw `ApiError` on non-2xx — use `rejects.toMatchObject({ status: 404 })` for expected errors.
- Cache expensive list calls in `beforeAll` when multiple tests assert on the same payload.
- Add missing endpoints to `gateway.sdk.ts` with the correct `E2EAuth`: `tenant`, `actor`, `internal`, or `none`.

### 2. Auth / security failures — raw HTTP

Use `ctx.get(url, { auth: 'none' })`, `ctx.post(...)`, or `e2eRequest` without tenant headers when testing middleware guards.

```typescript
const res = await ctx.get(toolGatewayRoutes.tools.catalogRoot, { auth: 'none' });
expectMissingTenantResponse(res);
```

**Place cross-cutting auth suites under `flows/security/`**, not inside feature happy-path files:

- `missing-tenant-auth.e2e.spec.ts` — `it.each` over `listMissingTenantEndpointCases()` from `protected-endpoints.ts`
- `cross-tenant-auth.e2e.spec.ts` — stateful tenant A vs tenant B (see below)
- `internal-api-key.e2e.spec.ts` — internal routes + API key

When adding a new protected route, append to `flows/security/protected-endpoints.ts` so missing-tenant and cross-tenant matrices stay complete.

---

## Auth model (`E2EAuth`)

| Auth       | Headers                     | Use for                              |
| ---------- | --------------------------- | ------------------------------------ |
| `tenant`   | `x-tenant-id`               | Default reads/writes                 |
| `actor`    | tenant + signed actor token | Mutations, user-scoped trigger reads |
| `internal` | tenant + internal API key   | `/v1/internal/*`                     |
| `none`     | (empty)                     | Negative tests — missing tenant      |

Multi-tenant second context:

```typescript
const built = buildTestContext();
const ctxA = built.ctx;
const ctxB = new TestContext({
  tenantId: built.identities.tenantB,
  actor: built.identities.ownerB,
});
```

---

## Stateful and optional suites

```typescript
import { loadEnv } from '../../config';

const describeStateful = loadEnv().allowStatefulTests ? describe : describe.skip;

describeStateful('flow: connection lifecycle', () => {
  // creates DB rows, revokes, etc.
});
```

Guard actor-dependent cases:

```typescript
import { hasActorTokenSecret } from '../../factories';

it('owner can revoke', async () => {
  if (!hasActorTokenSecret()) return;
  // ...
});
```

Read `config/env.ts` for service-specific flags (`allowStatefulTests`, `internalApiKey`, `enableComposioT3`, etc.).

---

## Fixtures and factories

**Fixtures** — re-export domain registries; do not duplicate catalog/connector lists in specs.

```typescript
// fixtures/connectors.fixtures.ts
export { allConnectors, connectorTriggerCatalogKey } from '../../../domain/connectors';
```

Specs assert against fixture-derived expected keys/slugs, not hard-coded magic strings scattered across files.

**Factories** — build request bodies with run-scoped IDs (`loadEnv().runId`, `randomUUID()`). Example: `buildInvokeBody`, `buildConnectionBody`, `buildIdentitySet`.

---

## Helpers

| Helper                                      | Purpose                              |
| ------------------------------------------- | ------------------------------------ |
| `expectMissingTenantResponse`               | 400 + missing `x-tenant-id` message  |
| `expectMissingActorResponse`                | actor guard                          |
| `expectCrossTenantResourceDenied`           | 403/404, no leak of other tenant ids |
| `expectToolShape` / `expectConnectionShape` | structural assertions on DTOs        |
| `expectComposioUserTenantMismatchResponse`  | composio namespace vs header tenant  |

Add new assertion helpers to `helpers/expect-http.ts` or `expect-shapes.ts` and export from `helpers/index.ts`.

---

## List endpoints — required query objects

Do not rely on `?? ''` defaults inside `SdkGateway`. Define explicit types in `gateway.types.ts` and default constants:

```typescript
export const defaultListConnectionsQuery: ListConnectionsQuery = {
  provider: '',
  ownerUserId: '',
  status: '',
  limit: '50',
  offset: '0',
};

await ctx.sdk.connections.list({
  ...defaultListConnectionsQuery,
  provider: 'google',
});
```

---

## Routes (`clients/routes/`)

Keep path strings in one place, aligned with Nest controllers. Still required for:

- Security matrices (`protected-endpoints.ts`)
- Raw HTTP when SDK has no client (e.g. metrics until generated)
- Internal / webhook paths with non-standard auth

Happy-path specs should prefer `ctx.sdk` over `toolGatewayRoutes` when the SDK client exists.

---

## Workflow: add coverage for a new endpoint

Copy this checklist:

```
- [ ] Controller method + auth documented
- [ ] SDK client method exists (or e2eRequest shim in SdkGateway)
- [ ] gateway.sdk.ts method with correct E2EAuth
- [ ] flows/<domain>/<feature>.e2e.spec.ts — happy path via ctx.sdk
- [ ] protected-endpoints.ts — missing-tenant case
- [ ] cross-tenant case (if resource is tenant-scoped) in cross-tenant-auth or domain isolation spec
- [ ] factories/fixtures/helpers extended if reused ≥2 times
- [ ] barrels updated (index.ts only exports public surface)
- [ ] User given nx run command (not executed by agent)
```

---

## TypeScript and test quality

- Import vitest explicitly: `import { describe, it, expect, beforeAll } from 'vitest'`.
- No `any`; use SDK DTO types or `unknown` + narrow helpers.
- No type assertions (`as`) in specs — build fixtures that satisfy types.
- Test success **and** failure where applicable.
- Prefer `responseText(res.data)` for leak checks on error bodies.
- Do not commit secrets; use `.env.e2e` documented in README.

---

## Running (tell the user)

```bash
# Full suite (tool-gateway example)
nx run tool-gateway-service:e2e

# Subset
nx run tool-gateway-service:e2e -- --testPathPattern=flows/tools
nx run tool-gateway-service:e2e -- --testPathPattern=flows/security
```

Service must be up locally (or `against-deployed` + `TOOL_GATEWAY_E2E_BASE_URL`) unless global setup skips readiness.

---

## Anti-patterns

- Importing `AppModule` or handler classes into e2e specs
- Duplicating missing-tenant tests inside every feature file
- Calling `HealthClient` / SDK directly without `TestContext` (bypasses header interceptor)
- Editing files under `client-sdk/`
- Empty `list()` query defaults hidden inside gateway — force explicit query objects
- One giant spec file for an entire domain
- Running e2e in CI without documenting required env vars

---

## Other apps in the monorepo

- **tool-gateway-service** — canonical Vitest layout described above; primary target for new HTTP e2e.
- **studio-backend** — separate Jest-based harness under `apps/studio-backend/e2e/`; see `RUNBOOK.md` there; do not assume identical folders.

When the user names a service, **read that service's e2e README first**, then apply this skill's patterns where they fit.
