---
name: langgraph-tool-schema-tests
description: Vitest type tests aligning LangGraph tool Zod schemas with ACP client SDK method signatures. Use when adding or changing tools under apps/langgraph-server (e.g. src/tools/api) or when asked for *.schema.spec.ts or SDK schema tests.
---

# LangGraph tool schema ↔ SDK tests

The old **`apps/langgraph-server/src/tools/curated`** tree and **`generate-tool-schema-specs.mjs`** were removed. CRM API tools live under **`src/tools/api/`** using **`ApiTool.create`** ([`api-tool.ts`](apps/langgraph-server/src/lib/sdk/api-tool.ts)), which wraps **`safeSdkCall`** + **`withAuth`**. Co-locate **`*.input.schema.ts`** / **`*.output.schema.ts`** with **`*.tool.ts`**; import tool input types from the **input** schema file in **`*.schema.spec.ts`** (see [`contacts-search`](apps/langgraph-server/src/tools/api/contacts/contacts-search/)).

Add a co-located **`{name}.schema.spec.ts`** next to each tool when you want compile-time checks that:

- **Input**: required SDK request fields are covered by the tool schema (use `expectTypeOf` + a small helper type if useful).
- **Output**: when returning structured data, the schema accepts the SDK response shape where applicable.

## Verify

```bash
npx tsc --project apps/langgraph-server/tsconfig.spec.json --noEmit
npx nx run langgraph-server:test
npx nx run langgraph-server:lint
```

## Related

- Tool authoring: [langgraph-tools](../langgraph-tools/SKILL.md)
- Vitest: `apps/langgraph-server/vitest.config.mts`
