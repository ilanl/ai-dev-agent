---
name: redis-service
description: Redis service domain expert. Redis connection credential management, tenant-specific connections, credential validation. Use when working in apps/services/redis-service/.
---
# Redis Service

**Location:** `apps/services/redis-service/src/`
**Port:** 1717, **Prefix:** `api-redis`

## Entities

- **RedisClientConnectionEntity** — id (UUID), tenantId (unique), username (unique), password (encrypted)

## API Endpoints

- `POST /api-redis/validation/check-connection` — validate Redis connection credentials
- `POST /api-redis/validation/create-connection` — create new Redis connection for tenant

## Commands & Queries

- `create-connection`, `check-connection`

## Key Business Rules

- Passwords are encrypted/hashed before storage
- Secure random password generation (12 chars) for new connections
- One connection per tenant (unique tenantId)
- Username must be unique across all tenants
- Generic error message for invalid credentials (security)
