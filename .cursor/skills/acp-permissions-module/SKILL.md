---
name: acp-permissions-module
description: ACP permissions module domain expert. Admin roles, role-based permissions, internal API keys, permission guards, sensitive data masking. Use when working in libs/modules/acp-permissions-module/ or with permission/authorization features.
---
# ACP Permissions Module

**Location:** `libs/modules/acp-permissions-module/src/`

## Key Entities

- **AdminAccountEntity** (`AdminAccountEntityKey`) — id, uuid, username, firstname, lastname, email, role, activated
- **AdminRolesEntity** (`AdminRolesEntityKey`) — id, name, isSystemRole. Role definitions
- **AdminRolePermissionsEntity** (`AdminRolePermissionsEntityKey`) — id, roleId, permissionObject, permissionAction. Permission assignments
- **AdminAccountRolesEntity** (`AdminAccountRolesEntityKey`) — junction: adminAccountUUID ↔ roleId
- **InternalApiKeyEntity** (`InternalApiKeyEntityKey`) — id, name (unique), apiKey (unique), validityDays

## Relationships

- AdminAccount N:N AdminRoles (via AdminAccountRoles junction)
- AdminRole 1:N AdminRolePermissions

## Permission System

- **Objects**: `payments`, `sensitive_data`, `staff_management`, `system_settings`, `export`, `crm`, `publish_transaction`
- **Actions**: `edit`, `view`
- **System Roles**: `payments_administrator`, `owner`, `team_member`

## Commands

- `create-role`, `update-role`, `delete-role`, `update-admin-roles`

## Queries

- `get-roles`, `get-role-details`, `get-admin-roles`, `get-admin-assignable-roles`, `get-admin-permissions`, `get-admin-payments-role-in-use`

## Exported Guards & Utilities

- `AdminPermissionsGuard` — NestJS guard checking permissions
- `@AdminPermissions(CRM_EDIT_PERMISSION)` — decorator for endpoints
- `MaskSensitiveDataInterceptor` — masks sensitive fields (taxId, accountNum, ibanNo, swift, etc.)
- `InternalApiKeyMiddleware` — validates internal API keys

## Key Business Rules

- Role names must be unique
- Cannot create roles with duplicate permission combinations
- Admins can only assign permissions they themselves have (unless ACP admin)
- System roles (`isSystemRole: true`) are protected from deletion
- `edit` permission implies `view` for the same object
