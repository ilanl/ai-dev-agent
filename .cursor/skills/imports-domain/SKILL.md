---
name: imports-domain
description: >-
  Imports domain expert for Agora CSV/Excel imports across ACP (client-admin),
  v2 NestJS modules (crm, invest, system), shared @agorareal/internal-common
  utilities, and etl-service bulk loads. Use for import profiles, contacts,
  payment methods, invest transactions, mapping, validation, batching, retries,
  duplicate detection, ETL jobs, or AgoraImport UI work.
---

# Imports Domain Expert

Operational guide for Agora’s **CSV import** system. Imports are **not** a single module—they are a **cross-cutting pattern** replicated per entity in `crm-module`, `invest-module`, `system-module`, ACP (`AgoraImport`), and `etl-service`.

## Architecture Overview

### Two import surfaces

| Surface | Where | Trigger | Data path |
|--------|--------|---------|-----------|
| **ACP UI import** | `development/client-admin` | User uploads CSV in drawer | `AgoraImport` → chunked HTTP → v2 `POST …/import/upsert` |
| **ETL bulk import** | `apps/services/etl-service` | Workflow / S3 file | Clean → validate → transform → `BaseApiService` → same v2 upsert APIs |

Both converge on **v2 CQRS commands** in `libs/modules/*` (never v1 `apps/api-server`).

### Standard import contract (backend)

Every import entity follows the same **read + write** pair:

1. **`import/*-get-list` query** — paginated snapshot of existing rows for UI diffing / association lookups.
2. **`import/upsert` command** (or `Upsert*Command` in invest) — batch upsert with partial success semantics.

**Response shape** (`UpsertCommandResponseDto` in `@agorareal/internal-common`):

```ts
{ created: string[]; updated: string[]; failed: Record<string, string>; warnings?: Record<string, string[]> }
```

- `failed` keys = **business identifier** (email, taxId, external id)—not DB id.
- Per-batch failures do **not** abort other batches (see batching).

**Options** (`UpsertCommandOptionsDto` / `keepExistingValueIfEmpty`):

- When `true`, empty/null CSV cells **do not overwrite** existing DB values.
- Backend: `getImportUpsertObjectDelta()` in `libs/packages/common/src/import/utils/import-upsert.util.ts`.
- Frontend: `state.ignoreNullValues` → `options.keepExistingValueIfEmpty` in `AgoraImportProvider`.

### Standard import contract (frontend)

`AgoraImport` (`development/client-admin/src/components_v2/UI/molecules/agora/AgoraImport/`):

| Step | Enum | Responsibility |
|------|------|----------------|
| Upload CSV | `AgoraImportStep.UPLOAD_FILE` | Parse file, headers |
| Map columns | `MAPPING_FIELDS` | CSV header → schema field |
| Review & import | `REVIEW_AND_IMPORT` | Validate, edit, detect create vs update |

Per-entity wiring lives in `…/import/index.tsx` + `schema.ts` + `drawer.tsx` (see profiles template below).

### Data flow (ACP profile import — reference implementation)

```
CSV file
  → AgoraImportProvider (map columns, validate, editedDataRef)
  → useImportProfilesUpsertMutation (chunkSize: 10)
  → POST /v2/crm/user-profiles/import/upsert
  → ImportUpsertUserProfilesCommandHandler
       bufferCount(BATCH_SIZE=20) → handleBatch
       → getExistingProfilesMap(identifierKey)
       → split create / update
       → BulkCreateProfilesCommand | PatchUserProfileCommand
       → customFieldsValuesClient (warnings, not hard fail)
  → merge chunk results → progress modal → invalidate React Query
```

**Server list for diffing** (loaded once per drawer open):

```
useImportProfilesGetListState(reduceKey)
  → getImportListQuery (pageSize 500, concurrent pages)
  → GET /v2/crm/user-profiles/import/list
  → mapDataWithServerData → entry.isUpdate + placeholders
```

### Shared package: `@agorareal/internal-common`

Published from `libs/packages/common/` (package name `@agorareal/internal-common`).

| Export | Path | Use |
|--------|------|-----|
| `ImportGetListQueryRequestDto` | `import/dto/import-get-list.query.request.dto.ts` | `page`, `pageSize` |
| `ImportGetListQueryValidator` | `import/validators/import-get-list.query.validator.ts` | Standard list-query Joi |
| `UpsertCommandOptionsDto` | `import/dto/import-upsert-options.request.dto.ts` | `keepExistingValueIfEmpty` |
| `UpsertCommandResponseDto` | `import/dto/import-upsert.command.response.dto.ts` | Standard upsert response |
| `ImportOptionDto` | `import/dto/import-option.dto.ts` | `import/get-options` dropdowns |
| `getImportUpsertObjectDelta` | `import/utils/import-upsert.util.ts` | Field-level merge for updates |
| `PagingResponseDto` | `dto/paging.dto.ts` | Paginated list responses |

---

## Key Services & File Locations

### Shared infrastructure

| Area | Path |
|------|------|
| Import DTOs/utils/validators | `libs/packages/common/src/import/` |
| Frontend chunk + retry | `development/client-admin/src/mutations/utils/import.ts` |
| Frontend paginated list fetch | `development/client-admin/src/queries/utils/import.ts` |
| Merge failed maps across chunks | `development/client-admin/src/components_v2/UI/molecules/agora/AgoraImport/utils/mergeImportResultMaps.ts` |
| AgoraImport core | `development/client-admin/src/components_v2/UI/molecules/agora/AgoraImport/` |

### CRM (`libs/modules/crm-module`)

| Entity | Get list query | Upsert command | Controller |
|--------|----------------|----------------|------------|
| **Profiles** | `application/user-profiles/queries/import-profiles-get-list/` | `commands/import-upsert-user-profiles/` | `api/controllers/user-profile/user-profile.controller.ts` |
| Profile payment methods | `queries/import-user-profile-payment-methods-get-list/` | `commands/import-upsert-user-profile-payment-methods/` | same controller |
| Clearshift PMs | `queries/import-user-profile-clearshift-payment-methods-get-list/` | `commands/import-upsert-user-profile-clearshift-payment-methods/` | same controller |
| **Contacts** | `application/contacts/queries/import-contacts-get-list/` | `commands/upsert-contacts/` | `api/controllers/contacts/contacts.controller.ts` |
| Organizations | `organizations/queries/import-organizations-get-list/` | `commands/upsert-organizations/` | `organizations.controller.ts` |
| Org contacts | `import-organization-contacts-get-list/` | upsert org contact cmd | organizations controller |
| Relationship settings | `import-relationship-settings-get-list/` | upsert cmd | `relationship-settings.controller.ts` |
| User relation managers | `import-user-relation-managers-get-list/` | upsert cmd | `user-relation-managers.controller.ts` |

**Profile API routes** (prefix `/v2/crm/user-profiles`):

- `GET import/list` — `importGetProfileList`
- `GET import/get-options` — identifier keys (`taxId`, `legalName`, `uuid`)
- `POST import/upsert` — main profile import
- `GET import/payment-methods-list`, `POST import/upsert-payment-methods`
- `GET import/clearshift-payment-methods-list`, `POST import/upsert-clearshift-payment-methods`
- `POST suggested-contacts` — contact association hints during profile import

**Contacts**: `POST /v2/crm/contacts/import/upsert` → `UpsertContactsCommand`

**Frontend CRM import**

| Entity | Schema / UI | State | Mutation |
|--------|-------------|-------|----------|
| Profiles | `client-admin/.../crm/profiles/import/` | `state/crm/profile/import/` | `mutations/crm/profile/import/useImportProfilesUpsertMutation.ts` (chunk **10**) |
| Contacts | `.../crm/contacts/import/` | `state/crm/contacts/import/` | `useImportContactsUpsertMutation.ts` (chunk **200**) |
| PM import | `.../profiles/PaymentMethods/import/` | profile import state | payment-method mutations |

Profile DTO mapping: `ImportProfileDto` (FE) ↔ `application/user-profiles/dto/import-profile.dto.ts` (BE).

Residency fields on profile import are transformed in `ImportUpsertUserProfilesCommandHandler.getResidencyFromProfile()` — check `isResidencyDifferentFromAddress`, `residencyCountry/State/City/Name`, `residencyType`.

### Invest (`libs/modules/invest-module`)

Upsert commands use naming `Upsert*` (not `ImportUpsert*`) but expose routes as `POST import/upsert`.

| Area | Upsert command folder | Notes |
|------|----------------------|-------|
| Commitments | `commitments/commands/upsert-commitments/` | `@Transactional()` |
| Capital transactions | `capital-transactions/commands/upsert-*` | |
| Legal entities | `legal-entities/commands/upsert-legal-entity/` | |
| Classes, assets | respective `upsert-*` | |
| Distributions / capital calls / NAVs / net incomes | `upsert-distribution`, `upsert-capital-call`, etc. | Often **3 endpoints**: `import/upsert`, `import/upsert/details`, `import/upsert/statuses` |
| Positions | cap-table-positions upsert | |

**Frontend**: `client-admin/src/components_v2/UI/organisms/invest/**/import/`, `state/invest/**/import/`, `queries/invest/**/import.ts`, `mutations/invest/**/import/`.

Transaction imports also use specialized parsers: `invest/transactions/hooks/import/import-transaction-parser.hook.tsx`.

### System

| Entity | Command | Path |
|--------|---------|------|
| External indexes | `import-upsert-external-indexes` | `system-module/application/integration/commands/import-upsert-external-indexes/` |

### ETL service (`apps/services/etl-service`)

| Doc | `apps/services/etl-service/docs/etl-jobs-overview.md` |
| Base class | `application/jobs/base/base-etl-job.service.ts` |
| Profile job | `application/jobs/profiles/profiles-etl-job.service.ts` |
| Contacts job | `application/jobs/contacts/contacts-etl-job.service.ts` |
| Config example | `application/jobs/profiles/profile.etl.config.ts` |

ETL pipeline stages: **S3 file → clean → flat validate → transform → (group) → DTO validate → loadBatch (chunked API calls with retries)**.

`ProfilesEtlJobService`: `chunkSize = 100`, `maxRetries = 3`, `retryDelayMs = 1000`, calls CRM SDK `importUpsertUserProfiles`.

Field mappings: `GetFieldMappingsQuery` + `IFieldMapping` (tenant-specific column maps).

---

## Batching & Retry (critical)

### Three batch layers (do not confuse)

| Layer | Default size | Config | Failure scope |
|-------|-------------|--------|---------------|
| **FE chunk** (`useImportMutation`) | 200 (profiles: **10**) | `chunkSize` in mutation hook | Whole chunk → all rows in `failed` with same message |
| **BE batch** (`bufferCount`) | **20** | `IMPORT_*_BATCH_SIZE` env / `global` in tests | Entire batch → every identifier in `failed` |
| **ETL load chunk** | 100 (profiles) | `chunkSize` on job service | Retries API call up to `maxRetries` |

Processing is **sequential across batches** (`concatMap`) — no parallel batches within one request.

### Frontend retry (`useImportChunkMutation`)

- Retries **only HTTP 500** via `promise-retry`: 2 retries, 10s min timeout.
- 4xx fails fast; entire chunk marked failed using `objectIdentifier`.

### Backend batch failure

On batch exception, handlers typically:

```ts
result.failed = profiles.reduce((acc, profile) => {
  acc[identifier] = error?.message ?? 'Unknown error';
  return acc;
}, {});
return result; // does not rethrow — other batches continue
```

QA hooks: regex patterns like `__fail__.*test` on email/name (`FAIL_EMAIL_ADDRESS_PATTERN`, `IMPORT_*_ENABLE_FORCE_FAIL_BATCH`).

### List-query retry (`getImportListQuery`)

- Fetches page 1, then concurrent page windows (`maxConcurrentRequests`, default 5).
- Retries pages on 5xx with `promise-retry` (3 retries, exponential backoff).

---

## Validation Pipeline

### Frontend (AgoraImport)

1. **Schema** (`@Tools/schema` + Zod in entity `schema.ts`) — parsers for enums, dates, countries, booleans.
2. **Column mapping** — `SchemaFields.areRequiredFieldsMapped`.
3. **Review step** — per-cell validation via `validateValue` in `useReviewEntries`; duplicate identifiers via `identifiersRef` + `validateIdentifier`.
4. **Associations** — `associationValidator`, server data from get-list (`serverData` keyed by identifier).

Empty strings → `null` before API (`startImport` in provider).

### Backend

1. **Joi command validator** — `*CommandValidator` / `ImportGetListQueryValidator`.
2. **Command handler** — business rules (e.g. profiles require contacts + primary contact).
3. **Delegated commands** — `BulkCreateProfilesCommand`, `PatchUserProfileCommand`, etc.

### ETL

1. `BaseFlatValidatorService` — raw row rules from config.
2. `BaseDtoValidatorService` — DTO shape after transform.
3. API validator — same as UI path once DTO built.

---

## Mapping & Duplicate Detection

### Column mapping (UI only)

`useMapColumns` + `MapColumnsStep` — user maps CSV headers to schema keys. Stored in `state.mappedColumns`.

### Create vs update detection (UI)

`mapDataWithServerData`: if `serverData[identifier]` exists → `isUpdate: true` and `placeholders` from server row.

Requires **get-list** loaded and `reduceKey` aligned with `entryIdentifier` / backend `identifierKey`.

### Duplicate rows in CSV (UI)

`useReviewEntries` builds `identifiersRef`; duplicate `entryIdentifier` values throw validation error in review table.

### Backend identity

Profiles: `options.identifierKey` ∈ `taxId` | `legalName` | `uuid` (`legalName` maps to `profile.name` in DTO).

Contacts: typically `portalUserEmailAddress` (see upsert handler).

Invest: often external index / entity-specific keys (see each validator).

---

## Investigation Workflow

Use this order for import tickets:

1. **Identify surface**: ACP `AgoraImport` vs ETL job vs one-off CSV feature (e.g. distribution adjustments drawer).
2. **Entity + module**: CRM vs invest vs system — locate `import/` folder under `application/` and matching FE `…/import/schema.ts`.
3. **Read schema** (FE): parsers, required fields, associations, custom fields (`useAgoraImportCustomFieldsSchema`).
4. **Trace API**: controller `@Post('import/upsert')` → command handler → check `BATCH_SIZE`, identifier field, `keepExistingValueIfEmpty` handling.
5. **Compare get-list vs upsert DTOs**: field names must match (e.g. profile `name` in upsert vs `legalName` in list DTO).
6. **Chunk sizes**: FE mutation `chunkSize` vs BE `IMPORT_*_BATCH_SIZE` — mismatches cause confusing partial progress.
7. **Reproduce failure type**: single row vs whole batch vs chunk — check `failed` keys match UI identifier.
8. **Custom fields**: often WARN via `warnings`, not `failed` (profiles pattern).
9. **ETL only**: `etl-job-records`, error logs, `profile.etl.config.ts` mappings, external indices collector.
10. **Tests**: handler spec with `global['IMPORT_*_BATCH_SIZE']`; validator spec; FE rarely E2E except dedicated specs.

**SDK**: Generated clients in `libs/modules/*/src/client-sdk/` — regenerate after DTO changes; ACP uses `@agorareal/crm-client-sdk` / `invest-client-sdk`.

---

## Dangerous / Sensitive Areas

| Risk | Why |
|------|-----|
| **Identifier key mismatch** | FE `reduceKey` / `entryIdentifier` / BE `identifierKey` must align or updates become creates (or wrong row). |
| **Dual batching** | FE chunk ⊂ BE batch — a FE chunk of 10 still splits into BE batches of 20; failure attribution is per BE batch. |
| **Partial success semantics** | HTTP 200 with populated `failed` is normal; UI must merge chunk results (`mergeImportResultMaps`). |
| **keepExistingValueIfEmpty** | Inverted UX: “override null values” toggle maps to `ignoreNullValues` in provider. Wrong default wipes data. |
| **Profile ↔ contacts coupling** | Import upsert requires valid `contacts[].id` + primary; uses `getSuggestedContactsByProfileMeta` in drawer. |
| **Custom fields after main write** | Profile import: CF upsert after create/update; failures → `warnings` only. |
| **Residency mapping** | `getResidencyFromProfile` + address fields; easy to break with `isResidencyDifferentFromAddress`. |
| **Transaction variable unused** | `ImportUpsertUserProfilesCommandHandler` declares `transaction` but never starts one — do not assume atomic batch without verifying handler. |
| **`console.log` in profile handler catch** | Batch errors logged to console — prefer structured logger when touching. |
| **Created UUID index mapping** | `createPayload.forEach((profile, idx) => created[idx])` assumes array order stable. |
| **ETL vs UI** | ETL can bypass UI validation; flat validator must stay in sync with Joi/command rules. |
| **Invest multi-endpoint imports** | Distributions/NAVs/capital calls: parent + details + statuses must stay consistent. |
| **Permissions** | Profile import upsert uses `CRM_EDIT_PERMISSION` guard. |

---

## Safe Modification Guidelines

### Adding / changing import fields

1. Add to **import list DTO** + query mapper (`import-*-get-list.query.ts`).
2. Add to **upsert request DTO** + validator schema.
3. Update **handler** mapping (create + update paths); use `shouldSetProperty` / `getImportUpsertObjectDelta` for updates.
4. Update **FE `schema.ts`** with parser + `displayName` for column mapping.
5. Regenerate **client SDK**; update `ImportProfileDto` or local FE type if duplicated.
6. Add **unit tests**: validator + handler (success, batch failure, keepExistingValueIfEmpty).

### New import entity (prefer extending pattern)

- Backend: `import/{entity}-get-list` query + `import/upsert` command mirroring nearest neighbor.
- Reuse `ImportGetListQueryValidator`, `UpsertCommandResponseDto`, `bufferCount` batching.
- Frontend: copy `profiles/import/drawer.tsx` organism template; wire `AgoraImportDrawer` + `useImportMutation`.

### Batching changes

- Tune BE env `IMPORT_*_BATCH_SIZE` for DB/mediator pressure.
- Tune FE `chunkSize` for request timeout / payload size (profiles use 10 due to weight).
- Keep FE chunk ≤ reasonable payload; do not parallelize batches without explicit design.

### Do not

- Add import endpoints to v1 `api-server`.
- Return raw Sequelize entities from import APIs.
- Skip get-list when UI needs update detection or association autocomplete.
- Change `failed` key format without updating FE `objectIdentifier` / download-failed-CSV logic.

---

## Testing Expectations

### Backend (required)

- **Validator spec**: Joi matches DTO; required/optional/nullable.
- **Handler spec** with in-memory SQLite (`memDb`): create, update, `keepExistingValueIfEmpty`, batch failure (force-fail env), identifier key variants.
- Set `global['IMPORT_*_BATCH_SIZE']` in tests for deterministic batching.

### Frontend

- Schema/parser unit tests where complex (enums, residency, tax types).
- Manual: map columns → review duplicates → import → progress modal counts → failed CSV download.
- Invalidate correct `queryCache.keys.*` in mutation hook.

### ETL

- Job service tests under `apps/services/etl-service/src/application/jobs/**/tests/`.
- E2E: `src/e2e/jobs/profiles/profiles-etl-job.e2e-spec.ts`.

---

## Things To Avoid

- Assuming **queue/RabbitMQ** for UI imports — they are synchronous HTTP batch commands (ETL uses job tracker + S3, not queue-module).
- Treating **warnings** as failures (custom fields, partial CF upsert).
- **Parallel batch processing** inside one command without understanding DB deadlocks.
- **Type assertions** in new code (repo convention); use proper DTO types.
- Creating a **second import flow** instead of extending `AgoraImport` + existing upsert command.
- Editing only SDK models without backend DTOs (OpenAPI drift).
- Using **`import/get-list`** path literally — actual routes vary (`import/list`, `import/payment-methods-list`, etc.); check controller.

---

## Quick Reference: Env vars (profiles & contacts)

| Variable | Default | Module |
|----------|---------|--------|
| `IMPORT_USER_PROFILES_BATCH_SIZE` | 20 | Profiles upsert |
| `IMPORT_CONTACTS_BATCH_SIZE` | 20 | Contacts upsert |
| `IMPORT_CONTACTS_ENABLE_FORCE_FAIL_BATCH` | true | QA |
| `FAIL_EMAIL_ADDRESS_PATTERN` | `/^__fail__.*test$/` | QA force fail |

Invest commands follow `IMPORT_{ENTITY}_BATCH_SIZE` pattern (e.g. `IMPORT_COMMITMENTS_BATCH_SIZE`, `IMPORT_LEGAL_ENTITIES_BATCH_SIZE`).

---

## Related skills

- `crm-module` — profiles, contacts, relationships
- `invest-module` — positions, transactions, legal entities
- `etl-service` — bulk load pipelines
- `create-command` / `create-query` — scaffolding new import endpoints
- `write-unit-tests` — handler/validator specs
