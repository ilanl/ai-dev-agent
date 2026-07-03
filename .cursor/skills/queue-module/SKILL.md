---
name: queue-module
description: Queue module domain expert. RabbitMQ tenant queue processing, message handling, HelloSign document status updates, notification forwarding. Use when working in libs/modules/queue-module/ or with queue/messaging features.
---
# Queue Module

**Location:** `libs/modules/queue-module/src/`

Infrastructure module for tenant-aware RabbitMQ message processing.

## Entities

No database entities — infrastructure module only.

## Architecture

- **TenantSubscriber** — extends RabbitSubscriber for tenant-aware queue consumption
- Uses message handlers factory pattern for different message types

## Supported Message Types

- `HELLOSIGN_DOC_STATUS_UPDATE` — HelloSign document status changes
- `AML_ALERT` — AML alert notifications
- `REPORT_READY` — report generation notifications
- `ACCREDITATION_ALERT` — accreditation status notifications
- `CONTACT_NOTIFICATION` — investor/contact emails (activation, password reset, etc.); forwarded to CRM `ContactNotificationHandler`

## External Clients

- **DocumentsQueueHellosignDocsClient** (`DocumentsQueueHellosignDocsClientKey`) — HelloSign document queue processing
- **QueueNotificationsClient** (`QueueNotificationsClientKey`) — notification queue processing

## Key Business Rules

- Tenant ID from message payload must match current tenant — mismatch causes ACK (no retry)
- Error delay configurable via `RABBITMQ_TENANT_SUBSCRIBER_ERROR_DELAY_MS`
- Request context injected for handler execution
- Internal API key authentication for forwarded requests
