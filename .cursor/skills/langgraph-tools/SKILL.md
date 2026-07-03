---
name: langgraph-tools
description: Create LangGraph server tools by discovering API endpoints in module client SDKs, mapping request/response DTOs, and scaffolding tool wrappers with Zod schemas. Use when creating tools for apps/langgraph-server or wrapping API endpoints from libs/modules.
---

# LangGraph Tools Creation

Create tools for `apps/langgraph-server` that wrap API endpoints from `libs/modules/*/client-sdk`. The legacy **`tools/curated`** + **`runCuratedToolCall`** layout was removed.

**API tools** use **`ApiTool.create`** in [`apps/langgraph-server/src/lib/sdk/api-tool.ts`](apps/langgraph-server/src/lib/sdk/api-tool.ts): it guards missing `RunnableConfig`, wraps the SDK call with **`safeSdkCall`** (which applies **`withAuth`** + JSON error strings), and returns LangChain **`tool()`**. **Runtime** CRM/invest (and related) calls should go through [`apps/langgraph-server/src/lib/api/`](apps/langgraph-server/src/lib/api/) helpers where they exist (paging, retries, auth); import SDK **types** freely. **`execute`** should not return raw SDK payloads directly—see **`{basename}.mapper.ts`** below.

For nodes or code that are not LangChain tools, call **`safeSdkCall(config, () => SomeClient.method(...))`** directly (see ingestion RAG [`retrieve.ts`](apps/langgraph-server/src/agents/ingestion-rag/nodes/retrieve.ts)).

For heavy **request** shaping shared by several tools, add a **local** helper next to those tools or under `src/tools/api/_helpers/` — avoid a generic facade layer unless duplication is real.

## Quick Start

When the user specifies an API endpoint (path, operationId, or controller method):

1. Find the client method in `libs/modules/*/client-sdk/src/services/`
2. Identify request and response DTOs from the method signature
3. Create `src/tools/api/{domain}/{basename}.input.schema.ts`, `{basename}.output.schema.ts`, **`{basename}.mapper.ts`**, and `{basename}.tool.ts` with **`ApiTool.create`** + **`execute`** that calls **`lib/api`** (or the SDK where no helper exists), then returns **`map…Output(...)`** from the mapper so the payload matches **`outputSchema`** (avoids production Zod failures when the API drifts).
4. Register the tool in the agent(s) that need it

## Discovery

**By URL path**: Search for `url: '/v2/...'` in `libs/modules/*/client-sdk/src/services/*.ts`

**By operationId**: Search for the method name (e.g. `getContactDetails`) in client services. The method name matches `@ApiOperation({ operationId: '...' })` in controllers.

**By controller**: Locate in `libs/modules/*/api/controllers/`, read `@ApiOperation`, then find the matching client method.

## Key Locations

| Purpose | Path |
|---------|------|
| Tools root | `apps/langgraph-server/src/tools` (RAG, search, canvas, flows, etc.) |
| **API-style LLM tools** (CRM example) | `apps/langgraph-server/src/tools/api/` |
| **`ApiTool` + `safeSdkCall` + `withAuth`** | `apps/langgraph-server/src/lib/sdk/api-tool.ts`, `client.ts` |
| SDK axios registration | `apps/langgraph-server/src/lib/sdk/register-client-sdks.ts` |
| Client SDKs | `libs/modules/{crm,fundraising,invest,documents,emails,payments}-module/src/client-sdk/src/services/` |
| DTOs | `libs/modules/*/client-sdk/src/models/*.ts` |

## SDK clients and `lib/api`

Prefer **`lib/api`** for tool orchestration when a helper exists. Otherwise import static clients from **`@agorareal/{crm|fundraising|invest|documents|emails|payments|waterfall}-client-sdk`**. **`safeSdkCall`** applies **`withAuth`**. Prefer **`import type`** from SDK models in mappers and schemas.

## Tool structure

Place new API-facing tools under `apps/langgraph-server/src/tools/api/{domain}/`. Use a **four-file basename** (same prefix as the tool file):

| File | Role |
|------|------|
| `{basename}.input.schema.ts` | Zod tool arguments; export widened **`z.ZodType<YourInput>`** for TS2589; export input type via **`z.infer`** |
| `{basename}.output.schema.ts` | Zod schema for the **successful** tool return value (what **`safeSdkCall`** validates after **`execute`**) |
| `{basename}.mapper.ts` | **Required.** Maps **`lib/api`** / SDK results to the exact shape of **`outputSchema`**: explicit fields, **`null` → `undefined`** where the schema expects optional props, stable **`fetchErrors`** / paging objects. Reuse **`to*Subset`** row mappers from sibling **`search-*`** tools when listing; list-by-filters tools still have their own mapper file that assembles the top-level object. |
| `{basename}.tool.ts` | **`ApiTool.create({ name, description, schema, outputSchema, execute })`** — **`execute`** returns only the mapper result (no raw SDK objects). |

Pass **`outputSchema`** so **`safeSdkCall`** validates the success payload before **`JSON.stringify`**. It does not apply to error responses from **`safeSdkCall`**’s catch path.

Domains: crm, fundraising, invest, documents, emails, payments, waterfall (mirror SDK packages as needed).

## File template (`ApiTool.create` + co-located schemas + mapper)

Follow the **`search-contacts`** tool under [`contacts/contacts-search/`](apps/langgraph-server/src/tools/api/contacts/contacts-search/): [`search-contacts.input.schema.ts`](apps/langgraph-server/src/tools/api/contacts/contacts-search/search-contacts.input.schema.ts), [`search-contacts.output.schema.ts`](apps/langgraph-server/src/tools/api/contacts/contacts-search/search-contacts.output.schema.ts), [`search-contacts.mapper.ts`](apps/langgraph-server/src/tools/api/contacts/contacts-search/search-contacts.mapper.ts) (`toContactSubset` + any list assembly), [`search-contacts.tool.ts`](apps/langgraph-server/src/tools/api/contacts/contacts-search/search-contacts.tool.ts). **`execute`** maps input to **`lib/api`** / SDK request(s), maps rows through the mapper, and returns a value that matches **`outputSchema`**.

## Workflow

### 1. Identify client and types

From the client service file: class name, parameters, return type.

### 2. Add the tool files

1. Create **`{basename}.input.schema.ts`** — Zod fields with **`.describe()`**; export widened schema + input type.
2. Create **`{basename}.output.schema.ts`** — Zod schema for the success response (top-level shape is usually enough).
3. Create **`{basename}.mapper.ts`** — Export **`map…Output`** / **`to…Subset`** functions typed against **`z.infer<typeof …OutputSchema>`** (or exported output types). This is the only place that should adapt API quirks to the Zod contract.
4. Create **`{basename}.tool.ts`** — **`ApiTool.create`** with **`schema`**, **`outputSchema`**, and **`execute`** that awaits **`lib/api`** / SDK work, then **`return map…(...)`** (no manual **`withAuth`** — **`ApiTool`** uses **`safeSdkCall`**).

### 3. Wire into agents

Import the tool in the agent(s) that need it (`tools` array on **`createAgent`** / deep agent subagent).

### 4. Schema ↔ SDK tests (optional)

Add **`*.schema.spec.ts`** next to the tool; see [langgraph-tool-schema-tests](../langgraph-tool-schema-tests/SKILL.md).

### 5. New SDK surface (rare)

Add or regenerate the client in `libs/modules/*/client-sdk`, wire **`register-client-sdks.ts`** if needed, then call the new method from your tool.

## Naming Conventions

- Tool name (LangChain): `snake_case` (e.g. `get_contact_details`)
- Folder: `kebab-case` (e.g. `get-contact-details`)
- Description: One sentence, action-oriented

## Examples

Use the live **`search_contacts_api`** tool as the reference implementation for list/search endpoints with paging and filters.

## Additional Resources

- For client SDK layout and DTO patterns, see [reference.md](reference.md)
