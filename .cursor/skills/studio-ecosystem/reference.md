# Studio Ecosystem — Per-Service Reference

Companion to [SKILL.md](SKILL.md). Each section documents one app/service with its internal structure, entities, endpoints, and key files.

---

## 1. studio-backend (`apps/studio-backend`)

### Architecture

Single NestJS module (`StudioBackendModule`). Global prefix: `/api-studio-backend`. Clean Architecture with CQRS via `Mediator` from `@agorareal/common`.

### Layers

| Layer       | Path                   | Role                                                            |
| ----------- | ---------------------- | --------------------------------------------------------------- |
| API         | `src/api/controllers/` | REST controllers, guards, interceptors, middlewares, decorators |
| Application | `src/application/`     | CQRS command/query handlers per domain                          |
| Domain      | `src/domain/`          | Sequelize entities, enums, constants, tenant types              |
| Infra       | `src/infra/`           | DB provider, HTTP clients, Temporal bridge, WebSocket gateway   |

### Domain entities (`src/domain/entities/`)

All extend `BaseTenantEntity` (tenant-scoped via CLS + RLS).

| Entity                                           | Relationship                                                                 |
| ------------------------------------------------ | ---------------------------------------------------------------------------- |
| `AgentEntity`                                    | Has many `AgentVersionEntity`                                                |
| `SkillEntity`                                    | Has many `SkillVersionEntity`                                                |
| `ToolEntity`                                     | Standalone persisted tool definitions                                        |
| `TaskDefinitionEntity`                           | JSON manifest + optional Temporal `scheduleId`                               |
| `RunEntity`                                      | BelongsTo AgentVersion, optional TaskDefinition; has `workflowId` (Temporal) |
| `RunEventEntity`                                 | HasMany from Run                                                             |
| `ApprovalEntity`                                 | BelongsTo Run; policy snapshot, tool call metadata                           |
| `ChatEntity`                                     | Per-user chat with visibility                                                |
| `MessageEntity`                                  | BelongsTo Chat                                                               |
| `DocumentEntity`                                 | Chat document storage                                                        |
| `StreamEntity`, `SuggestionEntity`, `VoteEntity` | Supporting chat tables                                                       |
| `EvalSuiteEntity`, `EvalRunEntity`               | Eval harness                                                                 |
| `TenantPolicyEntity`                             | Per-tenant policy JSON                                                       |
| `SdkAuthSessionEntity`                           | SDK session lookup                                                           |

### Application domains and CQRS handlers

| Domain               | Commands                                                     | Queries                              |
| -------------------- | ------------------------------------------------------------ | ------------------------------------ |
| `agents`             | create/update/delete agent; version draft/publish/archive    | get/list agents and versions         |
| `skills`             | CRUD; version draft/publish/archive; publish pipeline steps  | get/list skills and versions         |
| `runs`               | create, cancel, update status, emit event, dispatch triggers | get, list, events, SDK session       |
| `approvals`          | create, approve run, deny run                                | list pending, get                    |
| `evals`              | CRUD suite, run suite                                        | get/list suites and runs             |
| `task-definitions`   | create/update/delete                                         | get/list                             |
| `tools`              | test tool                                                    | (query handlers exist but not wired) |
| `chat`               | create/delete, update title/visibility                       | get, history                         |
| `message`            | save/update/delete-after-timestamp                           | by id, by chat, count                |
| `document`           | save, delete versions, sync to ingestion                     | list, versions, latest               |
| `threads`            | send message, cancel                                         | get messages                         |
| `stream`             | create                                                       | by chat                              |
| `tenant-policy`      | update                                                       | get                                  |
| `user`               | create, get-or-create                                        | by email                             |
| `inbox`              | —                                                            | list threads                         |
| `suggestion`, `vote` | save/vote                                                    | by document/chat                     |
| `connections`        | — (DTO types only; proxied to tool-gateway)                  | —                                    |

### HTTP controllers

| Controller                  | Base path          | Notes                                                  |
| --------------------------- | ------------------ | ------------------------------------------------------ |
| `AgentsController`          | `v1/agents`        | CRUD + versions                                        |
| `SkillsController`          | `v1/skills`        | CRUD + versions + publish                              |
| `RunsController`            | `v1/runs`          | Create, list, events, cancel, approve/deny             |
| `ThreadsController`         | `v1/threads`       | Thread messages                                        |
| `ApprovalsController`       | `v1/approvals`     | List/get pending                                       |
| `TaskDefinitionsController` | `v1/tasks`         | CRUD                                                   |
| `ToolsController`           | `v1/tools`         | Catalog, test                                          |
| `ConnectionsController`     | `v1/connections`   | Proxy to tool-gateway                                  |
| `ConnectorsController`      | `v1/connectors`    | Catalog from gateway                                   |
| `EvalSuitesController`      | `v1/eval-suites`   | CRUD + run                                             |
| `EvalRunsController`        | `v1/eval-runs`     | List/get                                               |
| `InboxController`           | `v1/inbox/threads` | Thread list                                            |
| `InternalController`        | `v1/internal/*`    | `InternalApiKeyGuard` — callbacks from worker/services |
| `ChatController`            | `chat`             | CRUD                                                   |
| `DocumentController`        | `document`         | Upload/download/sync                                   |

### Infra services

| Provider                  | Role                                                               |
| ------------------------- | ------------------------------------------------------------------ |
| `WorkflowBridgeService`   | Temporal client: start/signal/query/cancel workflows and schedules |
| `ToolGatewayClient`       | HTTP proxy to tool-gateway-service                                 |
| `MemoryServiceClient`     | HTTP to memory-service (run state read)                            |
| `IngestionHttpService`    | HTTP to ingestion-service (document sync)                          |
| `DocumentsStorageService` | S3 via documents-service SDK                                       |
| `EvalRunnerService`       | Eval orchestration                                                 |
| `ApprovalExpiryScheduler` | Scheduled approval timeout                                         |
| `RunsGateway`             | Socket.IO WebSocket for run events                                 |

### Key files

- Module: `src/studio-backend.module.ts`
- Config: `src/infra/env/config/config.ts`
- Temporal bridge: `src/infra/services/workflow-bridge.service.ts`
- Entity index: `src/domain/entities/index.ts`
- Generated SDK: `src/client-sdk/`

---

## 2. studio-frontend (`apps/studio-frontend`)

### Architecture

Next.js 16 + React 19, App Router, shadcn/Radix UI, Tailwind 4, SWR + Zustand.

### Directory structure

| Area          | Role                                                        |
| ------------- | ----------------------------------------------------------- |
| `app/(auth)/` | Login/register, NextAuth config                             |
| `app/(app)/`  | Authenticated shell with sidebar                            |
| `app/api/`    | BFF route handlers                                          |
| `features/`   | Domain feature code (hooks, components, schemas)            |
| `components/` | Shared UI (`ui/` shadcn, `chat/`, data tables)              |
| `lib/`        | API routes/client, navigation, AI helpers                   |
| `services/`   | Server-side: studio-backend SDK, agora-api, auth, langgraph |
| `shared/`     | Constants, stores, utils, errors, types                     |

### Data flow (browser → backend)

1. **SWR hook** → `apiClient` + `API_ROUTES.agentsPlatform.*`
2. **BFF** → `app/api/agents-platform/**/route.ts`
3. **Operations** → `services/studio-backend/operations/agents-platform/*.ts`
4. **SDK** → `@agorareal/studio-backend-client-sdk` (generated)
5. **studio-backend** REST API

### State management

- **SWR** — primary data fetching (`createEntityHooks` factory)
- **Zustand** — local UI state (`use-app-store`, `use-canvas-store`, `agent-chat-store`, Ask My Data stores)
- **NextAuth** — session with `idToken`, `tenantId`, `email`

### Auth and permissions

- NextAuth Credentials provider → auth-service SDK
- `useAgentPermissions` — role-based flags (currently `ALLOW_ALL_AGENT_PERMISSIONS = true`)
- Nav filtering via `requiredPermissions` in `nav-config.ts`

### Key files

- API routes map: `lib/api/api-routes.ts`
- API client: `lib/api/api-client.ts`
- Nav config: `lib/navigation/nav-config.ts`
- SDK client setup: `services/studio-backend/client.ts`
- Hook factory: `features/agents-platform/hooks/create-entity-hooks.ts`

---

## 3. langgraph-server (`apps/langgraph-server`)

### Architecture

Dev-only LangGraph CLI app (Node 22). The project is kept as reference/local
development code and is not a production runtime.

### Graph registry (`langgraph.json`)

| Graph ID                   | Export                                                                  | Pattern                                          |
| -------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------ |
| `agora-preprocess-rag`     | `src/agents/preprocess-rag/agent.ts:agent`                              | StateGraph with classify/plan/execute/synthesize |
| `lpa2waterfall`            | `src/agents/lpa2waterfall/agent.ts:agent`                               | StateGraph workflow + agent wrapper              |
| `lpa2waterfall-workflow`   | `src/agents/lpa2waterfall/agent.ts:lpa2waterfallWorkflow`               | Workflow graph export                            |

### Tool patterns

| Type              | Location                       | Mechanism                                                    |
| ----------------- | ------------------------------ | ------------------------------------------------------------ |
| API tools         | `src/tools/api/<domain>/<op>/` | `ApiTool.create` + Zod schemas + SDK calls via `safeSdkCall` |
| Preprocessed data | `src/tools/preprocessed-data/` | Multi-tenant SDK with internal key                           |
| Search            | `src/tools/search/`            | Tavily web search                                            |
| File publish      | `src/tools/files/`             | Upload to studio-backend documents                           |
| Workflow tools    | `src/tools/workflows/`         | Invoke standalone LangGraph workflows                        |

### SDK integration

- `src/lib/sdk/register-client-sdks.ts` — configures Agora domain SDKs with per-request auth from `langgraph_auth_user`
- `src/lib/sdk/sdk-axios.ts` — shared axios factory with Bearer + tenant headers
- `src/lib/sdk/api-tool.ts` — `ApiTool.create` factory with Zod validation

### MCP integration

- `src/lib/mcp-client.ts` — `MultiServerMCPClient` pointing at `AGORA_MCP_SERVER_URL`
- `src/lib/mcp-session.ts` — per-thread MCP session cache
- `src/lib/mcp-deep-native-tools.ts` — native list/call tools for deep agents

### Auth

- `src/auth.ts` — LangGraph auth handler, validates via `validateAcpUser` (auth-service HTTP)
- Sets `langgraph_auth_user` with `tenantId`, `userId`, `token`

### Checkpointer

- `src/lib/checkpointer.ts` — `MemorySaver()` (in-process, non-durable)

---

## 4. temporal-worker (`apps/temporal-worker`)

### Architecture

Temporal worker process. Single task queue `agent-tasks`. Webpack bundles workflows separately from activities.

### Workflows (`src/domains/workflows.ts`)

| Workflow                        | Purpose                                                                                 |
| ------------------------------- | --------------------------------------------------------------------------------------- |
| `customAgentTaskWorkflow`       | Main agent run: step loop with signals (approval, cancel) and queries (status, history) |
| `scheduledTaskDispatchWorkflow` | Dispatch scheduled task run via studio-backend                                          |
| `composioTriggerEventWorkflow`  | Dispatch Composio trigger events to subscriptions                                       |

### Activities

| Activity                                        | Domain                  | Role                                                                |
| ----------------------------------------------- | ----------------------- | ------------------------------------------------------------------- |
| `initCustomAgentRun`                            | custom-agent            | Load conversation state, build initial RunState, emit `run.started` |
| `customAgentStep`                               | custom-agent            | One agent turn: build graph, stream, handle interrupts              |
| `emitEvent`                                     | shared                  | POST run events to studio-backend internal API                      |
| `updateRunStatus`                               | shared                  | POST status to studio-backend internal API                          |
| `createSummary`                                 | shared                  | POST episodic summary to memory-service                             |
| `dispatchScheduledRunActivity`                  | scheduled-jobs          | POST to studio-backend                                              |
| `prepare/finalize/dispatchComposioTriggerEvent` | composio-trigger-events | Dispatch trigger subscriptions and mark events terminal             |

### Agent runtime

- `src/domains/custom-agent/runtime/agent-factory.ts` — `buildDeepAgent` using deepagents + LangGraph libraries in-process
- `src/domains/custom-agent/runtime/gateway-tool-adapter.ts` — creates LangChain tools from tool-gateway catalog
- `src/shared/agent-execution/session-builder.ts` — calls memory-service `assembleContext`
- `src/shared/agent-execution/core-factory.ts` — model provider setup

### HTTP clients

| Client                | Target                                                     |
| --------------------- | ---------------------------------------------------------- |
| `StudioBackendClient` | `STUDIO_BACKEND_URL` → `/api-studio-backend/v1/internal/*` |
| `ToolGatewayClient`   | `TOOL_GATEWAY_URL` → `/api-tool-gateway-service/v1/*`      |
| `MemoryServiceClient` | `MEMORY_SERVICE_URL` → `/api-memory-service/v1/*`          |

---

## 5. mcp-server (`apps/mcp-server`)

### Architecture

NestJS app, global prefix `/api-mcp-server`. Exposes MCP protocol over Streamable HTTP at `POST /mcp`.

### Tool system

- `defineAgoraTool({ key, name, description, authMode, riskLevel, execute })` — standard tool definition
- `invokeAgoraTool` — validates Zod input/output
- Per-domain tool barrels: `src/tools/{crm,invest,fundraising,documents}/index.ts`
- **59 tools** total across CRM (24), invest (32), fundraising (2), documents (1)

### SDK execution

- `AgoraSdkContextStore` (AsyncLocalStorage) holds per-request tenant/auth context
- `AgoraSdkExecutionService.execute(context, callback)` wraps tool calls
- `createAgoraSdkAxiosInstance` sets `baseURL`, `tenant-id`, `Authorization` from context
- SDKs: `@agorareal/crm-client-sdk`, `invest-client-sdk`, `fundraising-client-sdk`, `documents-client-sdk`, `waterfall-client-sdk`

### Auth

- `McpJwtGuard` → shared `JwtGuard` + auto-set `agora-api-sdk: client_admin`
- `McpAuthResolverService` — resolves tenant, user, baseUrl from JWT
- `TenantService` — resolves tenant baseUrl (dev: localhost:7070, prod: auth-service lookup)

### Additional APIs

- `SdkResolverController` at `/sdk/proxy/*` — generic HTTP proxy to tenant baseUrl
- `getLangChainTools` — exposes same tools as LangChain `DynamicStructuredTool` (used by langgraph-server)

---

## 6. tool-gateway-service (`apps/services/tool-gateway-service`)

### Architecture

Multi-tenant NestJS service, global prefix `/api-tool-gateway-service`. Tool catalog + invoke + connections + Composio.

### Entities

| Entity                     | Table                   | Role                                      |
| -------------------------- | ----------------------- | ----------------------------------------- |
| `ConnectionEntity`         | `connections`           | Tenant + provider + Composio account link |
| `ConnectionAuditLogEntity` | `connection_audit_logs` | Per-tool-call audit trail                 |

### Tool execution pipeline

1. `POST /v1/tools/invoke` receives `toolKey` + `input` + `RunContext`
2. `ToolCatalog` resolves tool definition
3. `PolicyEngine` checks tenant policy, agent policy, risk level → may create approval via studio-backend
4. `AdapterRegistry` routes to appropriate adapter:
   - **`sdk`** — calls Agora API via generated SDKs
   - **`connector`** — calls Composio `executeTool` with connected account
   - **`web_search`** — Tavily
5. Audit log emitted to studio-backend

### Connection management (Composio OAuth)

1. `POST /v1/connections/oauth/initiate` → Composio redirect URL
2. User completes OAuth in browser
3. `POST /v1/connections/oauth/complete` → persists `ConnectionEntity` with `composioConnectedAccountId`
4. Runtime: tools with `requiresConnection` resolve active connection → Composio execute

### Domain registries

- `ToolCatalog` — static catalog + generated connector tools
- `ConnectorRegistry` — connector definitions (Gmail, Calendar, Drive, Outlook, HubSpot, Salesforce, etc.)
- `AdapterRegistry` — pluggable `IToolAdapter` implementations
- `PolicyEngine` — merges catalog policy + tenant policy + agent policy

---

## 7. memory-service (`apps/services/memory-service`)

### Architecture

NestJS microservice, global prefix `/api-memory-service`, port 9011. Postgres with RLS.

### Memory types

| Type     | Table            | Scope                    | Description                                   |
| -------- | ---------------- | ------------------------ | --------------------------------------------- |
| Session  | `run_state`      | Per-run (+ conversation) | JSONB: messages, tool results, counters, cost |
| Episodic | `run_summaries`  | Per-agent                | Text summary, outcome, tools used             |
| Semantic | `semantic_facts` | workspace / agent / user | Key/value facts with merge rules              |

### Context assembly

`POST /v1/context/assemble` returns merged memory based on agent manifest `memory` flags:

- Session: current run state (or merged conversation states)
- Episodic: recent summaries for agent (default limit 10)
- Semantic: workspace → agent → user facts merged (narrowest scope wins)

### Endpoints

| Method         | Path                                     | Purpose                        |
| -------------- | ---------------------------------------- | ------------------------------ |
| POST           | `/v1/context/assemble`                   | Merged context for agent step  |
| GET/PUT/DELETE | `/v1/state/:runId`                       | Run state CRUD                 |
| GET            | `/v1/state/conversation/:conversationId` | Merged conversation state      |
| GET/POST       | `/v1/summaries`                          | List/create episodic summaries |
| CRUD           | `/v1/facts`                              | Semantic facts management      |

---

## 8. ingestion-service (`apps/services/ingestion-service`)

### Architecture

NestJS microservice, global prefix `/api-ingestion-service`. Postgres with pgvector. BullMQ for async processing.

### Document pipeline

1. `POST /ingest` → `IngestDocumentCommand` → dedup by `fileHash` → BullMQ job
2. Job handler: fetch (documents-service S3) → extract text (PDF/CSV/Excel + optional LLM vision) → chunk (`RecursiveCharacterTextSplitter`) → embed (`text-embedding-3-small`, 1536 dims) → store chunks with vectors
3. `POST /ingest/search` → cosine similarity via `embedding <=> :queryVector::vector`

### Structured objects

- `POST /structured-objects` — upsert JSON records with auto-generated embeddings
- `POST /structured-objects/search` — vector similarity + optional JSONB metadata filter

### Entities

| Entity                            | Table                          | Role                                   |
| --------------------------------- | ------------------------------ | -------------------------------------- |
| `IngestionDocumentEntity`         | `ingestion_documents`          | S3 reference, status, extraction stats |
| `DocumentChunkEntity`             | `document_chunks`              | Chunk text + `vector(1536)` embedding  |
| `StructuredObjectEmbeddingEntity` | `structured_object_embeddings` | JSON payload + `vector(1536)`          |

### Endpoints

| Method | Path                         | Purpose                          |
| ------ | ---------------------------- | -------------------------------- |
| POST   | `/ingest`                    | Start document ingestion         |
| GET    | `/ingest/:id`                | Ingestion status                 |
| POST   | `/ingest/search`             | Vector chunk search              |
| POST   | `/structured-objects`        | Upsert structured objects        |
| POST   | `/structured-objects/search` | Vector search structured objects |

### Config

- `OPENAI_API_KEY` — embeddings
- `EMBEDDING_MODEL` — default `text-embedding-3-small`
- `AGORA_DOCUMENTS_SERVICE_API_URL` — file fetch
- `GOOGLE_API_KEY` — optional LLM extraction fallback
- Redis — BullMQ job queue
