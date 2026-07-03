---
name: auth-service
description: Auth service domain expert. AWS Cognito integration, ACP and Portal user management, user pools, token validation, connection management. Use when working in apps/services/auth-service/.
---
# Auth Service

**Location:** `apps/services/auth-service/src/`
**Port:** 1616, **Prefix:** `api-auth`

## Entities

- **AcpUserEntity** — id (UUID), email
- **AcpUserConnectionEntity** — links ACP users to connections
- **AcpCognitoConnectionEntity** — Cognito connection for ACP
- **PortalUserEntity** — id (UUID), email
- **PortalUserConnectionEntity** — links portal users to connections
- **PortalCognitoConnectionEntity** — Cognito connection for portal
- **CognitoConnectionEntity** — base Cognito connection
- **AgoraTenantEntity** — tenant configuration

## API Endpoints

### ACP Routes (`/acp/auth/cognito`)
- `POST create-connection`, `add-users`, `validate-user`, `get-user-status`
- `POST users-list`, `uninvited-users-list`, `is-user-exist`
- `POST create-user`, `remove-user`, `sign-in-user`
- `PATCH update-user-password`
- `POST fetch-id-token-for-preview-user`

### Portal Routes (`/portal/auth/cognito`)
Same endpoints as ACP with portal-specific implementation.

## Architecture

Uses direct service calls rather than CQRS commands/queries. Controller → Service → Cognito.

## External Integrations

- **AWS Cognito** — user pool management, authentication, token validation

## Key Business Rules

- Separate user pools for ACP (admins) and Portal (investors)
- Per-tenant Cognito configuration
- User lifecycle: create, remove, update password
- Token validation and status tracking
- Preview user token generation for testing
