---
name: emails-module
description: Emails module domain expert. Email drafts, batch sending, SendGrid, Nylas integration, domain management, email templates, personalization, senders, global CC/Reply-To. Use when working in libs/modules/emails-module/ or with email features.
---
# Emails Module

**Location:** `libs/modules/emails-module/src/`

## Key Entities (from @agorareal/daos)

- **InteractionEntity** (`InteractionEntityKey`) — email interactions
- **InteractionMailEntity** (`InteractionMailEntityKey`) — email details (subject, body, recipients)
- **EmailBatchDraftEntity** (`EmailBatchDraftEntityKey`) — batch email drafts
- **EmailTemplateEntity** (`EmailTemplateEntityKey`) — reusable email templates
- **DomainEmailEntity** (`IDomainEmailEntityKey`) — verified sender domains
- **SendgridDomainEntity** (`ISendgridDomainEntityKey`) — SendGrid domain configuration
- **GlobalCcEmailEntity** (`GlobalCcEmailEntityKey`) — global CC addresses
- **GlobalReplyToEmailEntity** (`GlobalReplyToEmailEntityKey`) — global Reply-To addresses
- **MailEventEntity** (`MailEventEntityKey`) — email delivery events
- **EmailInteractionMailRecipientsEntity** — email recipients
- **EmailInteractionMailDocumentLinksEntity** — document links in emails
- **InteractionFilterEntity** (`InteractionFilterEntityKey`) — email filtering

## Feature Areas

- Draft management: save, add/remove recipients, discard, publish, schedule
- Email templates: CRUD, document attachments
- Sender management: save/delete email senders, copy signatures
- Domain management: validate, save, delete domains (SendGrid)
- Global settings: CC emails, Reply-To emails
- Personalization: merge fields for dynamic content
- Nylas integration: auth, messages, users, blacklists
- Email events: delivery tracking via RabbitMQ

## External Integrations

SendGrid (email delivery, domain management, webhooks), Nylas (email client integration), Documents Service, System Client Settings

## Key Business Rules

- Domain validation uses sticky logic (consecutive failures threshold)
- Draft emails can be scheduled for future publishing
- Email personalization supports merge fields
- Domain refresh runs on configurable interval (default 3 hours)
- SendGrid webhook tracking auto-configured on bootstrap
- Inbound email webhooks configurable per tenant
