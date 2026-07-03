---
name: notifications-service
description: Notifications service domain expert. Knock integration, notification workflows, user preferences, channels, admin and investor notifications, RabbitMQ processing. Use when working in apps/services/notifications-service/.
---
# Notifications Service

**Location:** `apps/services/notifications-service/src/`
**Port:** 9000, **Prefix:** `api-notifications-service`

## Entities

- **NotificationEntity** — id, externalId (unique), name, userType (ADMIN/CONTACT), description, groupName, orderIndex
- **WorkflowEntity** — id, externalId (unique), notificationId (FK), channelId (FK), enabled, name
- **ChannelEntity** — id, externalId (unique), name, enabled
- **UserSubscriptionEntity** — id, userId (FK), notificationId (FK), channelId (FK), isSubscribed. Unique: `(userId, notificationId, channelId)`
- **UserEntity** — base user entity
- **TenantEntity** — tenantId, tenantName
- **AcpAdminEntity** — admin user entity
- **PortalContactEntity** — portal contact entity

## API Endpoints

- `POST /service-trigger/send` — trigger notification via Knock workflow
- `PATCH /preferences/save` — save notification preferences
- `POST /preferences/get` — get notification preferences
- `POST /auth/authenticate-user` — authenticate user (admin/portal)

## Queue Subscriber

**NotificationServiceRabbitListener** — RabbitMQ consumer
- Queue: `notifications-service:*`
- Message types: `NOTIFICATION_SERVICE_TRIGGER`, `NOTIFICATION_SERVICE_MIGRATION_PREFERENCES`, `NOTIFICATION_SERVICE_HEALTH_CHECK`
- Health checks every 30s

## External Integrations

- **Knock API** (`@knocklabs/node`) — notification workflow engine
  - Idempotency keys: `${tenant}:${workflowId}:${uuid}`
  - User keys: `admin-${uuid}` or `investor-${uuid}`
- **RabbitMQ** — async notification processing

## Key Business Rules

- Notifications scoped by userType (ADMIN or CONTACT)
- Workflows must be enabled with enabled channels
- User preferences (opt-out) respected unless `ignorePreferences=true`
- Recipients filtered per channel based on subscription preferences
- Multiple workflows can trigger per notification
- Health threshold: response time < 5s, last message within 60s
