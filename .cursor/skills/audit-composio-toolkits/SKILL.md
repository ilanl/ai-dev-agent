---
name: audit-composio-toolkits
description: Audit and fix Composio toolkit integrations in apps/services/tool-gateway-service, including connector tool definitions and curated trigger presets. Use when checking toolkit, tool, trigger, slug, description, config, risk, or event mapping drift against the live Composio API.
---

# Audit Composio Toolkits

Use this skill when auditing or correcting Composio-backed connector tools and trigger presets in `apps/services/tool-gateway-service`.

## Required Context

Read these first:

- `.cursor/skills/tool-gateway-service/SKILL.md`
- `.cursor/skills/add-composio-toolkit/SKILL.md`
- `apps/services/tool-gateway-service/src/domain/connectors/index.ts`
- Relevant connector files under `apps/services/tool-gateway-service/src/domain/connectors`
- `apps/services/tool-gateway-service/src/domain/composio/toolkits/`
- `apps/services/tool-gateway-service/src/domain/triggers/triggers.constants.ts`
- `apps/services/tool-gateway-service/scripts/audit-composio-curated.ts`

## API Setup

Use the live Composio API as the source of truth:

1. Get `COMPOSIO_API_KEY` from `apps/services/tool-gateway-service/.env` when possible.
2. If the key is missing, ask the user for `COMPOSIO_API_KEY`.
3. Do not audit live slugs or descriptions without an API key.
4. Determine the Composio version from each local tool and trigger descriptor before checking it:
   - If the descriptor records a version, use that exact version.
   - If the descriptor does not record a version, use Composio's default version `00000000_00`.
   - Never compare a descriptor against latest metadata unless latest is the descriptor's recorded version.
5. Use the Composio SDK/API to fetch each connector's toolkit by `composioToolkitSlug`.
6. Fetch the live tools and compare each connector tool against the API result for that tool slug and descriptor version.
7. Fetch the live trigger types and compare each trigger preset against the API result for that trigger slug and descriptor version.
8. Inspect all returned metadata, including `name`, `description`, `instructions`, `config`, `payload`, and `version`.

If any Composio API call fails, stop the audit immediately. Report which request failed, the HTTP status or SDK error, and why the audit cannot continue with partial live metadata.

## Versioned Audit Requirement

Always cross-test against the correct Composio version for both tools and triggers.

- Treat `00000000_00` as the version when a tool or trigger descriptor has no recorded version.
- Treat any recorded descriptor version as immutable during audit; do not replace it with latest metadata.
- When checking a tool slug, trigger slug, trigger config schema, trigger payload schema, description, risk, or warning text, compare against the API result for that descriptor's version before deciding whether the local code is valid.
- Report the version used for every audited tool and trigger preset in the findings.
- Use the version recorded on each local tool or trigger descriptor as the comparison target, then verify the Composio API result for that slug matches the descriptor's versioned metadata.

## Audit Scope

Audit curated Composio integration code under:

- `apps/services/tool-gateway-service/src/domain/connectors` (via `allConnectors`)
- `apps/services/tool-gateway-service/src/domain/composio/toolkits` (tool + trigger source of truth)

Only audit what is present in the code. Do not report missing skills, tools, triggers, toolkits, or broader Composio coverage that the code does not already attempt to expose.

Check:

- Each connector's `composioToolkitSlug` exists in Composio.
- Each connector tool slug exists in Composio and belongs to the connector toolkit.
- Connector tool `name` and `description` still match the live tool's purpose.
- Connector tool `riskLevel` still matches the live tool behavior (`read`, `write`, or `destructive`).
- Each trigger preset's `composio.triggerSlug` exists in Composio.
- Each trigger type belongs to the preset connector's `composioToolkitSlug`.
- Preset `displayName` and `description` still match the live trigger's purpose.
- Preset `triggerConfig` satisfies the live `config` schema.
- Preset `connectorSlug` exists in `allConnectors`.
- Preset `connectorName` mirrors the connector display name.
- Connector `triggers[].eventName` values are valid `external.*` event names.
- Live toolkit, tool, or trigger metadata does not mention deprecation, removal, unsupported behavior, migration requirements, breaking changes, special setup, or other warnings.

Do not change generated client SDK files.

## Audit-First Workflow

Always separate auditing from fixing:

1. Run the live audit and list every found issue first.
2. Include the relevant live Composio metadata, especially replacement slugs from deprecated descriptions.
3. Ask the user whether they want you to fix the issues in code.
4. Do not edit code until the user confirms they want fixes applied.

## Finding Tool Replacements

When a connector toolkit or tool slug is invalid:

1. Query available toolkits and tools by slug/name.
2. If the stale live tool is marked deprecated, read its `description`; Composio deprecated tool descriptions always name the replacement slug to use instead (for example: `DEPRECATED: Use GOOGLEDRIVE_FIND_FILE instead. ...`).
3. Prefer the explicit replacement slug from the deprecated tool description before searching for similarly named candidates.
4. Compare live `name`, `description`, toolkit ownership, and input schema before choosing.
5. If the candidate metadata mentions deprecated/deprecation, removal, unsupported behavior, migration requirements, breaking changes, special setup, or any other warning language, notify the user with the relevant text and ask whether to use it.
6. If multiple live candidates could match, ask the user to choose.
7. If no reliable replacement exists, report the connector or tool as blocked instead of guessing.

## Finding Trigger Replacements

When a preset's Composio trigger slug is invalid:

1. Query trigger types for the preset connector's toolkit.
2. If the stale live trigger is marked deprecated, read its `description`; Composio deprecated trigger descriptions always name the replacement slug to use instead.
3. Prefer the explicit replacement slug from the deprecated trigger description before searching for similarly named candidates.
4. Compare live `name`, `description`, `config`, and `payload` before choosing.
5. If the candidate metadata mentions deprecated/deprecation, removal, unsupported behavior, migration requirements, breaking changes, special setup, or any other warning language, notify the user with the relevant text and ask whether to use it.
6. If multiple live candidates could match, ask the user to choose.
7. If no reliable replacement exists, report the preset as blocked instead of guessing.

## Fix Rules

Apply targeted fixes:

- Do not remove existing connector tools or trigger presets during an audit fix.
- You may add new connector tools or trigger presets when the user asks for broader coverage.
- You may modify an existing connector tool or trigger preset only when that specific entry is broken (missing live slug, deprecated live slug, wrong toolkit ownership, incorrect description/semantics, wrong risk level, invalid trigger config, or broken event-name mapping).
- Replace stale `composioToolkitSlug`, tool `slug`, or trigger `composio.triggerSlug` values with exact live slugs.
- Update connector and tool names/descriptions when live semantics changed.
- Update trigger `displayName` and `description` when live trigger semantics changed.
- Update tool `riskLevel` when live behavior shows the current risk is wrong; ask the user if risk is ambiguous.
- Update trigger `triggerConfig` only when the live schema requires a new default or rejects the old one.
- Update toolkit `studioEventName` and `triggers/triggers.constants.ts` when introducing shared canonical event names.
- Do not apply a fix using toolkit, tool, or trigger metadata that contains deprecation or warning language until the user explicitly approves it.

Preserve stable preset ids unless product behavior changes. Preset ids are UI/BFF contracts and should not follow Composio slug churn.

## Validation

After edits:

- Use `ReadLints` for changed files.
- Re-run the live Composio audit checks for the affected connector tools and trigger presets.
- Continue fixing until the live audit is clean or a blocked product decision remains.

## Report

Summarize:

- Toolkits, connector tools, and trigger presets audited.
- Toolkit, tool, or trigger slugs/descriptions that were wrong.
- Any deprecation notices, setup warnings, migration notes, or other warning language found in Composio metadata.
- Files changed.
- Any connectors, tools, or trigger presets that could not be fixed without product input.
