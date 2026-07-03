---
name: amls-service
description: AML service domain expert. Anti-money laundering compliance, AML requests, risk matching, owner risk scoring, Parallel Markets integration, activity logs. Use when working in apps/services/amls-service/.
---
# AMLS Service

**Location:** `apps/services/amls-service/src/`
**Port:** 9012, **Prefix:** `/api/amls`

## Entities

- **OwnerEntity** — id (UUID), ownerUuid, tenantId, clientName
- **AmlRequestEntity** — id (UUID), type (enum), name, lastName, status (enum)
- **OwnerAmlRequestEntity** — links owners to AML requests
- **OwnerRiskScoreEntity** — risk scoring for owners
- **AmlProfileDataEntity** — profile data for AML requests
- **AmlRiskMatchDataEntity** — risk match data
- **ReviewRiskMatchEntity** — review status for risk matches
- **ActivityLogEntity** — activity logging

## API Endpoints

- `POST /api/amls/info` — get AML info
- `POST /api/amls/send-aml-request` — create AML record
- `POST /api/amls/upsert-review-risk-match` — upsert review risk match
- `POST /api/amls/upsert-owner-risk-score` — upsert owner risk score
- `GET /api/amls/owner-risk-score-by-uuid` — get owner risk score
- `POST /api/amls/get-activity-logs` — get activity logs
- `POST /api/public/webhook/parallel` — Parallel Markets webhook

## Commands

- `create-aml-record`, `upsert-review-risk-match`, `upsert-owner-risk-score`
- `create-aml-request`, `update-aml-request-status`
- `create-owner-aml-request`, `update-overall-status`
- `find-or-create-owner`
- `parallel-markets-webhook`
- `send-aml-alert-notification`

## External Integrations

- **Parallel Markets API** — AML vendor for compliance checks
- **RabbitMQ** — tenant queue subscriber for async processing

## Key Business Rules

- AML request status lifecycle (PENDING → COMPLETED, etc.)
- Owner risk scoring with vendor data
- Risk match review workflow
- Webhook processing for Parallel Markets updates
- Activity logging for full audit trail
