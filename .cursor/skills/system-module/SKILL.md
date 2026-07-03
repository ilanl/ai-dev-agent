---
name: system-module
description: System module domain expert. Client settings, feature flags, currency exchange rates, analytics (Mixpanel), Google Places, help center, external indexes, app categories. Use when working in libs/modules/system-module/ or with system-level features.
---
# System Module

**Location:** `libs/modules/system-module/src/`

## Key Entities

- **ClientSetting** (`ClientSettingEntityKey`) — tenant-level settings
- **TenantInfo** (`TenantInfoKey`) — tenant metadata
- **AppCategory** (`AppCategoryEntityKey`) — app category configuration
- All entities from `@agorareal/daos` for integration indexes

## Commands

- `create-external-indexes`, `upsert-integration-external-indexes`, `delete-integration-external-indexes`, `import-upsert-external-indexes`
- `send-events` — analytics events

## Queries

- `get-client-settings`, `get-app-categories`, `get-active-feature-flags`
- `get-currency-types`, `get-exchange-rates`, `get-system-currency-exchange-rates`
- `autocomplete-places` — Google Places API
- `get-help-center-widget-token`, `get-help-center-redirect-url`
- Analytics: `get-portal-analytics-init-info`, `get-portal-analytics-identify-info`, `get-admin-analytics-init-info`, `get-admin-analytics-identify-info`
- `import-external-indexes-get-list`

## Domain Errors

`usingBackupCurrencyExchangeRates`, `fetchingCurrencyExchangeRatesError`, `currencyExchangeRatesNotFound`, `devRevNotConfigured`, `adminAccountNotFound`

## External Integrations

- **Mixpanel** — ACP and Portal analytics (AcpMixpanelService, PortalMixpanelService)
- **Google Places** — address autocomplete
- **DevRev** — help center integration (conditional on DEVREV_APP_TOKEN)

## Key Business Rules

- External indexes deduplicated by `externalId:type:vendor` composite key
- Currency exchange rates cached with fallback to backup rates
- Feature flags retrieved from system configuration
- Help center requires DEVREV_APP_TOKEN
