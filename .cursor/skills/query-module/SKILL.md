---
name: query-module
description: Query module domain expert. Cross-module queries, lists (static/dynamic), advanced search, tax reports, document collections, scanned K1 processing, Metabase BI. Use when working in libs/modules/query-module/ or with cross-domain query features.
---
# Query Module

**Location:** `libs/modules/query-module/src/`

Aggregation module that queries across multiple domains (CRM, Invest, Documents, Fundraising, Payments, Bookkeeping).

## Key Entities

Uses all entities from `@agorareal/daos` for cross-module querying.

## Commands

- `create-list`, `update-list`, `delete-list-by-id` — static/dynamic list management
- `upload-asset-document`, `delete-document-type`
- `process-scanned-k1-document`, `approve-user-profile-scanned-fields`
- `delete-signature-template`

## Queries

- Lists: `get-all-lists`, `get-list-by-id`
- Managed views: `get-managed-view-by-entity-type`
- Balances: `get-user-profiles-balances`, `get-user-profiles-counts`
- Organization data: `get-positions-by-organization`, `get-investments-by-organization`
- Tax reports: `get-entity-tax-reports`, `get-tax-report-cash-flow`, `get-entities-tax-lacerte-report-data-for-export`
- Documents: `find-collections`, `shared-with`, `calc-documents-recipients`, `is-document-type-deletable`
- Bookkeeping: `get-bookkeeping-transactions`
- Signature templates: `get-signature-template-usages`
- Advanced search: contacts, user-profiles, prospects

## Domain Errors

`capTablePositionNotFound`, `scannedFieldsNotFound`, `missingApiKey`, `documentDoesNotExist`, `userProfileDoesNotExist`, `taxSeasonNotProvidedForScannedDocument`, `legalEntityNotFound`, `noScannedFieldsToApprove`, `failedToSaveDocument`

## List Types

- **STATIC** (0) — user groups with explicit members
- **DYNAMIC** (1) — query-based lists with filter criteria

## External Clients

Extensive: CRM, Documents, Invest, Fundraising, System, Payments, Bookkeeping, ESignature, Custom Fields, Auth, Metabase (Agora BI)
