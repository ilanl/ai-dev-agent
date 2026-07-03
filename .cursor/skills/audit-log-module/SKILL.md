---
name: audit-log-module
description: Audit log module domain expert. Audit trail entries, modification tracking, admin and investor activity logging. Use when working in libs/modules/audit-log-module/ or with audit logging features.
---
# Audit Log Module

**Location:** `libs/modules/audit-log-module/src/`

Read-only module — no commands, only queries and a logging service.

## Adding a new audit event

Follow the step-by-step skill:

**[add-audit-log skill](libs/modules/audit-log-module/.cursor/skills/add-audit-log/SKILL.md)**

Quick summary:
- `@UseInterceptors(AuditLogInterceptor)` + `@AuditLog(options)` + colocated `*.audit.ts` on authenticated routes
- Tests → `*.audit.spec.ts` + mock interceptor in controller specs

## Key Entities

- **AuditLogEntry** (`AuditLogEntryEntityKey`) — id (auto-increment), uuid, modifiedById, app (CLIENT_ADMIN/CLIENT_INVESTOR), action, method (CREATE/READ/UPDATE/DELETE), details (JSON)
  - Conditional relationship: links to AdminAccount when app=CLIENT_ADMIN, PortalUser when app=CLIENT_INVESTOR
- **AuditLogEntryModification** (`AuditLogEntryModificationEntityKey`) — id, attributePath, attribute, oldValue, newValue, auditLogEntryUUID
  - CASCADE delete with parent AuditLogEntry

## Queries

- `get-audit-log-entries` — paginated audit log with filtering
- `get-audit-log-summary` — aggregated audit log summary

## AuditLogService

Service-based logging that automatically tracks field-level changes using `deep-diff` library. Creates AuditLogEntry records with associated AuditLogEntryModification records for each changed field.

## Key Business Rules

- Conditional relationships: AdminAccount or PortalUser based on `app` field
- Cascade delete: modifications deleted when parent entry is deleted
- Deep diff tracking for field-level change audit trail
