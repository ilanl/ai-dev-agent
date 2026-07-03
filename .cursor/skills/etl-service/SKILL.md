---
name: etl-service
description: ETL service domain expert. ETL workflow configuration and execution, field mappings, storage configs, tenant credentials, S3/SQS integration, external index collection. Use when working in apps/services/etl-service/.
---
# ETL Service

**Location:** `apps/services/etl-service/src/`
**Port:** 8888 (API), 8889 (Worker), **Prefix:** `api-etl-service`

## Entities

- **EtlWorkflowConfigEntity** — id (UUID), tenantId, name, scheduleIntervalUnit/Value, filePattern, lastRunAt, nextRunAt, isEnabled
- **StorageConfigEntity** — storage configuration (S3, SQS)
- **TenantCredentialEntity** — encrypted tenant credentials
- **EtlConfigItemEntity** — ETL job configuration items
- **EtlJobEntity** — ETL job execution records
- **EtlJobRecordEntity** — individual records processed in jobs
- **EtlJobErrorLogEntity** — error logging
- **WorkflowExecutionEntity** — workflow execution tracking
- **ProcessedFileEntity** — file processing status
- **EtlObjFieldMappingEntity** — field mapping configuration
- **ClassesDestinationFields**, **LegalEntitiesDestinationFields** — destination field configs

## API Endpoints

### Workflows
- `POST /workflows/execute`, `GET /workflows/:id`

### Workflow Configs
- CRUD: `POST/GET/GET/:id/PUT/:id/DELETE/:id /etl-workflow-configs`
- Config items: `PUT/GET /etl-workflow-configs/:id/etl-items`

### Storage
- CRUD: `POST/GET/GET/:id/PUT/:id/DELETE/:id /storage-config`
- Files: `GET/POST /storage-files/:id/files|upload-url|download-url`
- Internal storage: `GET/POST /internal-storage-files/:id/files|upload-url|download-url`

### ETL Jobs
- `GET /etl-jobs/by-config/:etlConfigItemId`, `GET /etl-jobs/:id`, `GET /etl-jobs/:id/records`, `GET /etl-jobs/:id/error-logs`

### Field Mappings, External Indices, Tenant Credentials, Destination Fields
- CRUD and collection endpoints for each

## Supported ETL Job Types

Contacts, Profiles, Legal Entities, Classes, Commitments, Capital Transactions, Distributions, Sub-Distributions, Capital Calls, Sub-Capital Calls, NAVs, NAV Details

## External Integrations

- **AWS S3** — file storage, presigned URLs
- **AWS SQS** — event-driven workflow triggers
- **Redis** — optional caching
- **Agora Auth Service** — authentication
- **SDK Proxy/MCP Server** — data operations

## Queue Workers

- SQS event ingestion worker (S3 events via SQS)
- Workflow scheduler (interval-based)
- File ingestion worker

## Key Business Rules

- Multi-tenant ETL with encrypted credentials
- Scheduled and event-driven (SQS) workflow execution
- Field mapping with formula support
- File processing with status tracking and error logging
- External index collection for data enrichment
- Retry mechanisms for failed jobs
