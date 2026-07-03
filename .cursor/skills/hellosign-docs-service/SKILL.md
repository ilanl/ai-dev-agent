---
name: hellosign-docs-service
description: HelloSign docs service domain expert. Dropbox Sign PDF processing, signature document downloads, S3 uploads, RabbitMQ job queue. Use when working in apps/services/hellosign-docs-service/.
---
# HelloSign Docs Service

**Location:** `apps/services/hellosign-docs-service/src/`
**Port:** 9494, **Prefix:** `api-hellosign-docs-service`

## Architecture

Queue-based service that downloads completed signature documents from Dropbox Sign, uploads them to S3, and publishes status updates.

## Entities

Uses injected entities (ConvertedEsignature), not Sequelize entities.

## Commands

- `esignatures/record-queue-audit` — records queue processing audit

## Queue Subscriber

**DocsJobSubscriber** — RabbitMQ consumer
- Queue: `hellosign-docs-jobs:*`
- Exchange: `hellosign-docs-jobs-exchange`
- Workflow:
  1. Validates signature request clientId
  2. Downloads PDF from Dropbox Sign
  3. Uploads to S3 via presigned URL
  4. Publishes status to `hellosign-docs-status-exchange`

## External Integrations

- **Dropbox Sign API** (HelloSign) — downloads completed signature PDFs
- **AWS S3** — uploads signed PDFs via presigned URLs (max 100MB)
- **RabbitMQ** — consumes jobs, publishes status updates

## Key Business Rules

- Validates `clientId` matches signature request before processing
- Only processes completed signature requests
- Retry on rate limits (429), conflicts (409), incomplete requests (0)
- Exponential backoff: `delayMs * attempt` (max 5 retries)
- File size tracked in status messages
