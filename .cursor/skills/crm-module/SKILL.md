---
name: crm-module
description: CRM module domain expert. Organizations, contacts, user profiles, portal users, admin accounts, interactions, tasks, tags, emails, beneficial owners, related contacts, accreditation, AML. Use when working in libs/modules/crm-module/ or with CRM-related features.
---
# CRM Module

**Location:** `libs/modules/crm-module/src/`

## Key Entities (from @agorareal/daos)

- **OrganizationEntity** (`OrganizationEntityKey`) — id, name, type, residency, url, phone1-3, addressId
- **ContactEntity** (`ContactEntityKey`) — id, contactType, portalUserId, addressId, status, priority, residency
- **OrganizationContactEntity** (`OrganizationContactEntityKey`) — organizationId, contactId, staffRelation (junction)
- **UserProfile** (`UserProfileKey`) — id, investor profiles linked to contacts
- **PortalUser** (`PortalUserEntityKey`) — id, firstName, lastName, email, username, uuid
- **AdminAccountEntity** (`AdminAccountEntityKey`) — id, firstname, lastname, email, role, activated
- **InteractionEntity** (`InteractionEntityKey`) — id, email/event interactions
- **InteractionMailEntity** (`InteractionMailEntityKey`) — email interaction details
- **Task** (`TaskEntityKey`) — id, tasks with reminders; related: TaskMember, TaskRelatedContact
- **Tag** (`TagEntityKey`), **PortalUserTag** (`PortalUserTagEntityKey`) — tagging system
- **CrmRelationshipSettingsEntity** (`CrmRelationshipSettingsEntityKey`) — distribution/position access settings
- **CrmRelatedContactEntity** (`CrmRelatedContactEntityKey`) — contact relationships
- **BeneficialOwnerEntity** (`BeneficialOwnerKey`) — beneficial ownership tracking
- **RequestEntity** (`RequestEntityKey`) — investor requests
- **CrmManagedViewEntity** (`CrmManagedViewEntityKey`) — custom view configurations
- **RecentUpdateEntity** (`RecentUpdateEntityKey`) — recent updates for portal users
- **RecentDevelopmentEntity** (`RecentDevelopmentEntityKey`) — recent developments
- **UserProfilePaymentMethod** (`UserProfilePaymentMethodKey`) — payment methods linked to profiles

## Key Relationships

- Organization 1:N Contact (via OrganizationContactEntity junction)
- Contact N:1 PortalUser (via portalUserId)
- Contact N:1 Address (via addressId)
- UserProfile linked to Contact/PortalUser
- Tasks have TaskMembers and TaskRelatedContacts
- Interactions track emails, events, and communications

## Domain Errors (`domain/constants/errors.ts`)

`adminAccountNotFound`, `profilePictureFileRequired`, `userProfileNotFoundWithUUID`, `userProfileNotFoundWithTaxId`, `userTermsAndConditionsAlreadyAccepted`, `userProfileNotFoundWithId`, `userDoesNotHaveAccessToProfile`, `deleteProfilePaymentMethodFailed`, `bankAccountDoesNotBelongToUserProfile`, `recentUpdateNotFound`

## External Clients

Documents, Accreditation, Custom Fields, Bank Accounts, Clearshift, AML Service, Notifications Service, Email (Drafts, Nylas, SendGrid)

## Feature Areas

- `organizations/` — CRUD, tags, contacts, import, filter values
- `contacts/` — CRUD, bulk ops, import, email status, reassignment
- `profiles/` — CRUD, payment methods, custom fields, import
- `interactions/` — email/event tracking with associations
- `tasks/` — CRUD, reminders, scheduled emails
- `emails/` — scheduled email management
- `accreditation/` — vendor accreditation workflows
- `amls/` — AML request and risk scoring
- `beneficial_owners/` — bulk upsert/delete
- `admin-accounts/` — archive, profile pictures, terms
- `notifications/` — admin/investor notification preferences

## Reference

- Command: `application/organizations/commands/create-organization-contact/`
- Query: `application/organizations/queries/get-organization-details/`
- Controller: `api/controllers/contacts/contacts.controller.ts`
