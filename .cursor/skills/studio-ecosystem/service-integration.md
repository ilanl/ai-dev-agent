# Studio Ecosystem — Service Integration Reference

Companion to [SKILL.md](SKILL.md). Documents cross-service HTTP contracts, environment variables, and end-to-end data flows.

---

## Service dependency matrix

| Caller → Target      |                    studio-backend                     | temporal-worker | langgraph-server  | mcp-server |   tool-gateway    |   memory-service    |   ingestion-service    |
| -------------------- | :---------------------------------------------------: | :-------------: | :---------------: | :--------: | :---------------: | :-----------------: | :--------------------: |
| **studio-frontend**  |                        BFF→SDK                        |        —        | passthrough proxy |     —      |         —         |          —          |           —            |
| **studio-backend**   |                           —                           | Temporal client |         —         |     —      | ToolGatewayClient | MemoryServiceClient |  IngestionHttpService  |
| **temporal-worker**  |                     HTTP internal                     |        —        |         —         |     —      |       HTTP        |        HTTP         |           —            |
| **langgraph-server** |                   HTTP (documents)                    |        —        |         —         | MCP client |         —         |          —          |      SDK (search)      |
| **mcp-server**       |                           —                           |        —        |         —         |     —      |         —         |          —          | — (calls agora-api v2) |
| **tool-gateway**     | HTTP internal (approvals, SDK sessions, audit events) |        —        |         —         |     —      |         —         |          —          |           —            |

---

## Environment variables (inter-service URLs)

### studio-backend

| Var                               | Default                 | Target                         |
| --------------------------------- | ----------------------- | ------------------------------ |
| `TEMPORAL_ADDRESS`                | `localhost:7233`        | Temporal server                |
| `TEMPORAL_NAMESPACE`              | `default`               | Temporal namespace             |
| `TEMPORAL_TASK_QUEUE`             | `agent-tasks`           | Shared with temporal-worker    |
| `TOOL_GATEWAY_URL`                | `http://localhost:9010` | tool-gateway-service           |
| `MEMORY_SERVICE_URL`              | `http://localhost:9011` | memory-service                 |
| `AGORA_INGESTION_SERVICE_API_URL` | —                       | ingestion-service              |
| `AGORA_DOCUMENTS_SERVICE_API_URL` | —                       | documents-service (S3)         |
| `STUDIO_BUCKET_NAME`              | —                       | S3 bucket for studio documents |
| `INTERNAL_API_KEY`                | —                       | Guards `v1/internal/*` routes  |

### temporal-worker

| Var                       | Default                 | Target                                  |
| ------------------------- | ----------------------- | --------------------------------------- |
| `TEMPORAL_ADDRESS`        | `localhost:7233`        | Temporal server                         |
| `TEMPORAL_TASK_QUEUE`     | `agent-tasks`           | Must match studio-backend               |
| `STUDIO_BACKEND_URL`      | `http://localhost:9000` | studio-backend internal API             |
| `TOOL_GATEWAY_URL`        | `http://localhost:9010` | tool-gateway-service                    |
| `MEMORY_SERVICE_URL`      | `http://localhost:9011` | memory-service                          |
| `STUDIO_INTERNAL_API_KEY` | —                       | Auth for studio-backend internal routes |

### langgraph-server

| Var                               | Default                     | Target                            |
| --------------------------------- | --------------------------- | --------------------------------- |
| `AGORA_AUTH_SERVICE_API_URL`      | —                           | Auth validation                   |
| `AGORA_API_URL`                   | —                           | Agora API v2 (domain SDKs)        |
| `AGORA_MCP_SERVER_URL`            | `http://localhost:8081/mcp` | mcp-server                        |
| `AGORA_INGESTION_SERVICE_API_URL` | —                           | ingestion-service (RAG search)    |
| `AGORA_PRE_PROCESSING_API_URL`    | —                           | Pre-processing reader             |
| `STUDIO_BACKEND_API_URL`          | —                           | studio-backend (document publish) |
| `API_SERVER_API_KEY`              | —                           | Internal key for MT SDK auth      |
| `PGVECTOR_CONNECTION_STRING`      | —                           | PG for vector operations          |
| `OPENAI_API_KEY`                  | —                           | LLM model calls                   |

### mcp-server

| Var                          | Default | Target                             |
| ---------------------------- | ------- | ---------------------------------- |
| `AGORA_AUTH_SERVICE_API_URL` | —       | JWT validation                     |
| `AGORA_API_URL`              | —       | Agora API v2 (resolved per tenant) |
| `API_SERVER_API_KEY`         | —       | Internal service key               |
| `STUDIO_BACKEND_URL`         | —       | Optional SDK session resolution    |
| `STUDIO_INTERNAL_API_KEY`    | —       | Auth for studio-backend            |

### tool-gateway-service

| Var                          | Default | Target                                |
| ---------------------------- | ------- | ------------------------------------- |
| `STUDIO_BACKEND_URL`         | —       | Approvals, SDK sessions, audit events |
| `STUDIO_INTERNAL_API_KEY`    | —       | Auth for studio-backend internal API  |
| `COMPOSIO_API_KEY`           | —       | Composio service                      |
| `COMPOSIO_CALLBACK_BASE_URL` | —       | OAuth callback validation             |
| `API_SERVER_API_KEY`         | —       | Fallback SDK auth                     |
| `TAVILY_API_KEY`             | —       | Web search adapter                    |

### memory-service

| Var        | Default | Target                |
| ---------- | ------- | --------------------- |
| `DB_*`     | —       | PostgreSQL connection |
| `APP_PORT` | `9011`  | —                     |

### ingestion-service

| Var                               | Default                  | Target                  |
| --------------------------------- | ------------------------ | ----------------------- |
| `OPENAI_API_KEY`                  | —                        | Embeddings              |
| `EMBEDDING_MODEL`                 | `text-embedding-3-small` | —                       |
| `AGORA_DOCUMENTS_SERVICE_API_URL` | —                        | S3 signed URLs          |
| `GOOGLE_API_KEY`                  | —                        | Optional LLM extraction |
| Redis                             | —                        | BullMQ job queue        |

---

## Internal API contracts

### studio-backend internal routes (`v1/internal/*`)

Protected by `InternalApiKeyGuard` (`x-internal-api-key` header). Called by temporal-worker, tool-gateway, and mcp-server.

| Method | Path                                       | Caller          | Purpose                       |
| ------ | ------------------------------------------ | --------------- | ----------------------------- |
| POST   | `/v1/internal/runs/:runId/events`          | temporal-worker | Emit run event                |
| PUT    | `/v1/internal/runs/:runId/status`          | temporal-worker | Update run status             |
| POST   | `/v1/internal/runs/dispatch-task`          | temporal-worker | Dispatch scheduled task run   |
| POST   | `/v1/internal/approvals`                   | tool-gateway    | Create approval for tool call |
| GET    | `/v1/internal/sdk-sessions/:id`            | tool-gateway    | Resolve SDK session auth      |
| POST   | `/v1/internal/skills/:id/publish/validate` | temporal-worker | Publish pipeline step         |
| POST   | `/v1/internal/skills/:id/publish/eval`     | temporal-worker | Publish pipeline step         |
| POST   | `/v1/internal/skills/:id/publish/finalize` | temporal-worker | Publish pipeline step         |

### memory-service API (`/api-memory-service/v1/`)

Called by temporal-worker (primary) and studio-backend (read-only).

| Method | Path                             | Caller                          | Purpose                     |
| ------ | -------------------------------- | ------------------------------- | --------------------------- |
| POST   | `/v1/context/assemble`           | temporal-worker                 | Full context for agent step |
| GET    | `/v1/state/:runId`               | temporal-worker, studio-backend | Read run state              |
| PUT    | `/v1/state/:runId`               | temporal-worker                 | Save/update run state       |
| GET    | `/v1/state/conversation/:convId` | temporal-worker                 | Merged conversation state   |
| POST   | `/v1/summaries`                  | temporal-worker                 | Create episodic summary     |

### tool-gateway API (`/api-tool-gateway-service/v1/`)

Called by temporal-worker (primary) and studio-backend (proxy).

| Method | Path                             | Caller                          | Purpose                    |
| ------ | -------------------------------- | ------------------------------- | -------------------------- |
| POST   | `/v1/tools/invoke`               | temporal-worker                 | Execute tool with policy   |
| GET    | `/v1/tools/catalog`              | studio-backend, temporal-worker | List available tools       |
| GET    | `/v1/tools/catalog/:key`         | temporal-worker                 | Get tool definition        |
| GET    | `/v1/connectors`                 | studio-backend                  | List connector definitions |
| POST   | `/v1/connections/oauth/initiate` | studio-backend                  | Start OAuth flow           |
| POST   | `/v1/connections/oauth/complete` | studio-backend                  | Complete OAuth flow        |
| CRUD   | `/v1/connections/*`              | studio-backend                  | Connection management      |
| POST   | `/v1/composio/session-tools`     | temporal-worker                 | Dynamic Composio tools     |
| POST   | `/v1/composio/execute`           | temporal-worker                 | Execute Composio tool      |

---

## End-to-end flow: Create and run an agent

### 1. Agent creation (frontend → backend)

```
Browser → POST /api/agents-platform/agents (BFF)
  → operations/agents-platform/agents.ts → AgentsClient.createAgent
  → studio-backend POST /api-studio-backend/v1/agents
  → CreateAgentCommandHandler → AgentEntity.create
```

### 2. Agent version publish

```
Browser → POST /api/agents-platform/agents/{id}/versions/{vId}/publish (BFF)
  → studio-backend → PublishAgentVersionCommandHandler
  → AgentVersionEntity.update(status: 'published')
```

### 3. Run creation

```
Browser → POST /api/agents-platform/runs (BFF)
  → studio-backend POST /api-studio-backend/v1/runs
  → CreateRunCommandHandler:
    1. Load agent version manifest
    2. Read prior conversation cost from memory-service
    3. Create RunEntity (status: QUEUED)
    4. WorkflowBridgeService.startTask(customAgentTaskWorkflow, payload)
```

### 4. Temporal workflow execution

```
temporal-worker picks up customAgentTaskWorkflow:
  1. initCustomAgentRun:
     - memory-service GET /v1/state/conversation/{convId} (prior messages)
     - memory-service PUT /v1/state/{runId} (initial state)
     - studio-backend POST /v1/internal/runs/{runId}/status (RUNNING)
     - studio-backend POST /v1/internal/runs/{runId}/events (run.started)

  2. customAgentStep loop:
     - memory-service POST /v1/context/assemble (session + episodic + semantic)
     - Build LangGraph agent in-process (deepagents library)
     - Stream → studio-backend events (model.token, tool.requested, etc.)
     - Tool calls → tool-gateway POST /v1/tools/invoke
       → PolicyEngine checks → adapter invokes → result
     - If approval needed:
       → tool-gateway POST studio-backend /v1/internal/approvals
       → Workflow waits for signal (user approve/deny in frontend)
     - memory-service PUT /v1/state/{runId} (updated state)

  3. Finalization:
     - memory-service POST /v1/summaries (episodic summary)
     - studio-backend PUT /v1/internal/runs/{runId}/status (COMPLETED)
     - Optional: webhookDeliveryWorkflow
```

### 5. Real-time updates to frontend

```
studio-backend RunsGateway (Socket.IO /runs):
  - temporal-worker POSTs events to internal API
  - RunsController emits via RunsGateway.emitRunEvent(runId, event)
  - Frontend subscribes to room run:{runId}
```

---

## End-to-end flow: Studio chat

Studio chat runs through the Temporal-backed agent lifecycle. `apps/langgraph-server`
is kept for local reference/dev graphs only and should not be treated as a production
MCP chat runtime.

---

## End-to-end flow: Connection setup

```
Browser → POST /api/agents-platform/connections/oauth/initiate (BFF)
  → studio-backend ConnectionsController → ToolGatewayClient
  → tool-gateway POST /v1/connections/oauth/initiate
  → ComposioService.authorize → redirectUrl

Browser redirects to OAuth provider → user authorizes → callback

Browser → POST /api/agents-platform/connections/oauth/complete (BFF)
  → studio-backend → ToolGatewayClient
  → tool-gateway POST /v1/connections/oauth/complete
  → Verify Composio account → ConnectionEntity.findOrCreate
```

---

## Tenant context propagation

Every inter-service call carries `x-tenant-id` (or `tenant-id`) header. Each service validates and sets it:

| Service           | Mechanism                                                                   |
| ----------------- | --------------------------------------------------------------------------- |
| studio-frontend   | `studioContextFromSession` adds `x-tenant-id` to SDK calls                  |
| studio-backend    | `TenantMiddleware` → CLS → `TenantTransactionInterceptor` (Sequelize + RLS) |
| temporal-worker   | `DispatchRunPayload.tenantId` → set on all HTTP client calls                |
| langgraph-server  | `langgraph_auth_user.tenantId` → SDK axios interceptor                      |
| mcp-server        | `McpAuthResolverService` → `AgoraSdkContextStore`                           |
| tool-gateway      | `TenantMiddleware` → CLS → Sequelize transactions                           |
| memory-service    | `TenantMiddleware` → CLS → `TenantTransactionInterceptor` + RLS             |
| ingestion-service | `TenantMiddleware` + `TenantGuard` → CLS → `BaseTenantEntity`               |
