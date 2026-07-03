---
name: events-service
description: Events service domain expert. Event tracking, object events, tenant-aware event storage, RabbitMQ event ingestion. Use when working in apps/services/events-service/.
---
# Events Service

**Location:** `apps/services/events-service/src/`
**Port:** 7080

## Entities

- **EventEntity** — id (UUID), operationId (UUID, unique), tenantId (FK), objectUUID, objectType (enum), eventType (enum), eventDate, ipv4Address, portalUserUUID
- **TenantEntity** — tenantId (UUID), tenantName (unique)

## API Endpoints

- `POST /events/add-events` — add new events
- `POST /events/get-objects-events` — get events for multiple objects
- `POST /events/get-object-events` — get events for a single object

## Commands & Queries

- `events/add-events`, `events/get-object-events`, `events/get-objects-events`

## Queue Subscriber

**EventsServiceSubscriber** — RabbitMQ tenant queue subscriber
- Queue: `events-service:*`
- Processes `AddEventsCommand` via Mediator
- Health monitoring every 30s

## Key Business Rules

- Events are deduplicated by `operationId` (uses `ignoreDuplicates`)
- Tenant name must match if tenant already exists
- Invalid events are logged but don't stop processing
- Metrics tracked per tenant and event type
- Events stored transactionally
