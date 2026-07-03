---
name: reports-service
description: Reports service domain expert. PDF report generation, batch processing, worker management, HTML-to-PDF, RabbitMQ job queue, tenant provider management. Use when working in apps/services/reports-service/.
---
# Reports Service

**Location:** `apps/services/reports-service/src/`
**Port:** 9098, **Modes:** Dispatcher (queue) or Worker

## Entities

- **ReportEntity** — id, tenantId, batchId (FK), externalReportId, status (enum), bindingData (JSON), customInfo (JSON), lastError, retryCount. Unique: `(externalReportId, tenantId)`
- **BatchEntity** — id, tenantId, externalId, operationalId, provider (enum), template (JSON), scheduledAt, isPriority
- **WorkerEntity** — id, workerId, batchId (FK), tenantId, startedAt
- **TenantEntity** — tenantId, tenantName
- **TenantProviderEntity** — id, tenantId, provider (enum), configuration (JSON), enabled, lastSentAt, blockedUntilAt. Unique: `(tenantId, provider)`
- **AlertEntity** — id, tenantId, provider, type, reportedAt

## API Endpoints

- `POST /reports/html-pdf/preview` — generate PDF from HTML (returns ZIP buffer)

## Queue Subscriber

**ReportJobSubscriber** — runs in worker thread
- Queue: `report-jobs:*`
- Exchange: `report-jobs-exchange`
- Message type: `REPORT_BATCH`
- Publishes status to `report-status-exchange`

## External Integrations

- **RabbitMQ** — job queue and status publishing
- **HTML-to-PDF** — `@agorareal/reports` for PDF generation

## Key Business Rules

- Batches must have at least one report
- Reports deduplicated by `(externalReportId, tenantId)`
- Worker allocation with keep-alive (10s) and non-responsive threshold (60s)
- Max concurrent reports: 10 (configurable), max report size: 18MB
- Retry logic per error code (ENOTFOUND, ECONNREFUSED, 401, 403, 429)
- Rate limiting: providers can be blocked until specific time
- Priority batches via `isPriority` flag
- Dispatcher mode controls queue subscriber activation
