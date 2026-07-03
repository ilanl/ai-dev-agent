---
name: fundraising-module
description: Fundraising module domain expert. Offerings, prospects, subscriptions, brochures, data rooms, NDA templates, signature requests, smart forms, offering stages, acknowledgements, inbound leads. Use when working in libs/modules/fundraising-module/ or with fundraising features.
---
# Fundraising Module

**Location:** `libs/modules/fundraising-module/src/`

## Key Entities (from @agorareal/daos)

- **OfferingEntity** (`OfferingKey`) — investment offerings/deals
- **ProspectEntity** (`ProspectKey`) — potential investors in an offering
- **SubscriptionEntity** (`SubscriptionKey`) — investor subscriptions to offerings
- **OfferingTemplateEntity** (`OfferingTemplateKey`) — e-signature templates per offering
- **OfferingStageEntity** (`OfferingStageEntityKey`) — pipeline stages (prospect lifecycle)
- **OfferingFolderEntity** — data room folder structure
- **OfferingDocumentGroupEntity** (`OfferingDocumentGroupEntityKey`) — document grouping with rules
- **OfferingRuleEntity** (`OfferingRuleEntityKey`) — conditional rules for documents/visibility
- **OfferingNdaTemplateEntity** (`OfferingNdaTemplateKey`) — NDA document templates
- **OfferingNdaSignerEntity** (`OfferingNdaSignerKey`) — NDA signers
- **OfferingSignatureRequestEntity** (`OfferingSignatureRequestKey`) — signature request tracking
- **OfferingReservationEntity** (`OfferingReservationKey`) — investment reservations
- **BrochureEntity** (`BrochureKey`) — offering brochure documents
- **AcknowledgementEntity** (`AcknowledgementKey`) — subscription acknowledgements
- **InboundLeadV2Entity** (`InboundLeadV2Key`) — inbound lead forms
- **SubscriptionContactEntity** (`SubscriptionContactKey`) — contacts attached to subscriptions
- **CheckboxTrackerEntity** (`CheckboxTrackerKey`) — checkbox state tracking

## Feature Areas

- `offerings/` — CRUD, data room, brochures, resources, target audience
- `prospects/` — bulk create/update/delete, stage management, waitlist
- `subscription/` — create, update, delete, step management, prefill
- `subscription-documents/` — document attachment with portal visibility
- `subscription-merge-fields/` — merge field values for documents
- `subscription-smart-forms/` — smart form templates, values, rules, conditions
- `offering-stages/` — pipeline stage management with ordering
- `offering-templates/` — e-signature template management
- `offering-rules/` — conditional rules for document groups
- `offering-nda-templates/` — NDA template management with signers
- `offering-signature-requests/` — signature request tracking and reset
- `acknowledgement/` — offering acknowledgement management
- `brochures/` — brochure document management
- `offering-folders/` — data room folder structure
- `offering-additional-items/` — extra offering items
- `inbound-leads-v2/` — inbound lead form management

## External Clients

CRM (Contacts, UserProfiles, RelationshipSettings, AdminAccounts), E-Signature (Templates, Forms, SignatureRequests), Documents, Payments, ClientSettings, Automation

## Key Business Rules

- Offerings have stages defining the prospect pipeline
- Subscriptions follow multi-step flows with validation at each step
- Smart forms support rules and conditions for dynamic visibility
- NDA templates with document-level signer management
- Document groups can have conditional rules based on profile type, residency
- Prospect stages support ordering and bulk operations
