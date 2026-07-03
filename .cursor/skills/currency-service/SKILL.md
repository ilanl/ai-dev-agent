---
name: currency-service
description: Currency service domain expert. Exchange rate fetching, Redis caching, scheduled jobs, multi-currency support. Use when working in apps/services/currency-service/.
---
# Currency Service

**Location:** `apps/services/currency-service/src/`

NOT a NestJS service — standalone Node.js script that runs as a scheduled job.

## Architecture

- No HTTP server or API endpoints
- Fetches exchange rates from external API or S3
- Caches rates in Redis
- Runs as a CronJob

## Entry Point

`src/start/fetchAndSaveExchangeRates.ts`

## Supported Currencies

USD, ILS, TRY, GBP, EUR, CAD, TWD, SVC, AUD, LBP, ARS, TTD, KRW, CHF, CNY, INR, JPY, MXN, COP

## External Integrations

- **Exchange Rates API** — external API for fetching rates (`EXCHANGE_RATES_API` env var)
- **AWS S3** — fallback source for rates
- **Redis** — caching exchange rates

## Key Business Rules

- Fetches rates from external API, falls back to S3
- Caches rates in Redis for fast access
- Runs on a schedule (CronJob)
- No database entities — Redis-only storage
