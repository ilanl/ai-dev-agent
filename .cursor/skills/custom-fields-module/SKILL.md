---
name: custom-fields-module
description: Custom fields module domain expert. Custom field definitions, groups, values for user profiles, legal entities, contacts, organizations, positions, prospects. Use when working in libs/modules/custom-fields-module/ or with custom field features.
---
# Custom Fields Module

**Location:** `libs/modules/custom-fields-module/src/`

## Key Entities (from @agorareal/daos)

- **CustomFieldEntity** (`CustomFieldEntityKey`) — id, name, type, groupId, properties (JSON: defaultValue, placeholder, options, validation), order (auto-increment), archivedAt, createdByAdminId
- **CustomFieldGroupEntity** (`CustomFieldGroupEntityKey`) — id, name, entityType, order. Unique constraint: `(name, entityType)`
- **CustomFieldValueEntity** (`CustomFieldValueEntityKey`) — id, entityUUID, customFieldId, stringValue, textValue, numberValue, arrayValue (JSON), dateValue

## Type-to-Column Mapping

| CustomFieldType | Column |
|---|---|
| SELECT | stringValue |
| TEXT | stringValue |
| LONG_TEXT | textValue |
| NUMBER | numberValue |
| DATE | dateValue |
| MULTI_SELECT | arrayValue |

## Entity Types

`USER_PROFILES`, `LEGAL_ENTITIES`, `CRM_CONTACTS`, `CRM_ORGANIZATIONS`, `CAP_TABLE_POSITIONS`, `PROSPECTS`

## Commands

- Fields: `create-custom-field`, `patch-custom-field`, `delete-custom-field`, `archive-custom-field`, `restore-custom-field`
- Groups: `create-custom-field-group`, `patch-custom-field-group`, `delete-custom-field-group`
- Values: `upsert-custom-fields-values`, `upsert-multiple-custom-fields-values`, `bulk-upsert-custom-fields-values`, `delete-custom-fields-values`

## Queries

- `get-custom-fields`, `get-custom-field-groups`, `get-custom-fields-usage`, `get-custom-fields-values`

## Key Business Rules

- Maximum 100 custom fields per entity type
- Soft delete via `archivedAt` field (archive/restore)
- Group names must be unique per entity type
- Fields have auto-incrementing order within their group
