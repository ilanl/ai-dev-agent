---
name: data-module
description: Data module domain expert. Raw SQL queries, integration external indexes, payment method entities, SQL dialect conversion. Use when working in libs/modules/data-module/ or with raw data queries.
---
# Data Module

**Location:** `libs/modules/data-module/src/`

## Key Entities

- **PaymentMethodWireEntity** (`PaymentMethodWireEntityKey`) — wire transfer details
- **PaymentMethodCheckEntity** (`PaymentMethodCheckEntityKey`) — check payment details
- **IntegrationsExternalIndexEntity** (`IntegrationsExternalIndexEntityKey`) — id, externalId, agoraId, vendor (SALESFORCE/ETL), type (PORTAL_USER, USER_PROFILE, LEGAL_ENTITY, etc.)

## Queries

- `raw-sql-query` — executes read-only SQL queries with dialect conversion

## Key Technical Details

- Only SELECT queries allowed (validated via `isSelectQuery`)
- SQL dialect conversion for SQLite compatibility in tests (JSON_ARRAYAGG → json_group_array, JSON_VALUE → json_extract)
- Supports manual replacements and JSON/date column conversion
- Query types: GetUserProfiles, GetOrganizationsTemplate, GetProfilesTemplate, GetContactsTemplate, GetPaymentMethodsTemplate, GetCapitalCallsTemplate, GetDistributionsTemplate, GetMetricsTemplate, etc.

## External Index Types

PORTAL_USER, USER_PROFILE, LEGAL_ENTITY, CAP_TABLE_POSITION, COMMITMENT, OFFERING, DISTRIBUTION, CAPITAL_CALL, CAPITAL_TRANSACTION, BANK_ACCOUNT, CLASS, NET_INCOME_POSITION
