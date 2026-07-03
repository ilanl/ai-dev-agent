---
name: auth-module
description: Authentication module domain expert. ACP (admin) and Portal (investor) user authentication, Cognito integration, OTP verification, activation links. Use when working in libs/modules/auth-module/ or with authentication features.
---
# Auth Module

**Location:** `libs/modules/auth-module/src/`

## Key Entities

- **PortalUser** (`PortalUserEntityKey`) — id, firstName, lastName, username, email, uuid
- **AdminAccount** (`AdminAccountKey`) — id, firstname, lastname, username, email, uuid

## Commands

- `acp-auth/`: `create-acp-user`, `sign-in-acp-user`, `remove-acp-user`
- `portal-auth/`: `create-portal-user`, `sign-in-portal-user`, `verify-otp-portal-user`, `remove-portal-user`, `register-activation-link`

## Queries

- `acp-auth/`: `check-acp-user-exists`, `get-acp-user-status`
- `portal-auth/`: `check-portal-user-exists`, `get-portal-user-status`, `get-all-investors-with-status`, `get-all-uninvited-emails`

## External Integrations

Auth Service (`AuthServiceClient`) — external service handling Cognito operations for both ACP and Portal authentication flows.

## Key Business Rules

- Separate auth flows for Portal users (investors with OTP) and ACP users (admins)
- Activation link registration for new users
- User status tracking (active, invited, uninvited)
