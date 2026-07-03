---
name: reports-module
description: Reports module domain expert. Report generation, report templates, binding data for profiles/contacts/positions, template library. Use when working in libs/modules/reports-module/ or with report generation features.
---
# Reports Module

**Location:** `libs/modules/reports-module/src/`

## Key Entities

- **ReportEntity** (`ReportEntityKey`) — id, reportName, reportType (REPORT_PROFILE/REPORT_CONTACT/REPORT_POSITION), templateId (FK), reportData (JSON)
- **ReportTemplateEntity** (`ReportTemplateEntityKey`) — id, templateName (unique), templateType, templateData (JSON), themeData (JSON), previewData (JSON), externalDataFields (JSON), isSystem
- **PositionPaymentMethodEntity** (`PositionPaymentMethodEntityKey`) — position payment method data

## Commands

- Report generation: `generate-profiles-report`, `generate-contacts-report`, `generate-positions-report`
- Binding data: `get-profiles-binding-data`, `get-contacts-binding-data`, `get-positions-binding-data` (and by-template variants)
- Templates: `create-template`, `update-template`, `duplicate-template`, `delete-template`, `delete-template-images`

## Queries

- `get-templates-list`, `get-template-by-id`, `get-reports-list`
- Email binding data: `get-profiles-email-binding-data`, `get-positions-email-binding-data`, `get-contacts-email-binding-data`
- `get-user-profiles-salutations`, `get-position-payment-method-binding-data`, `get-s3-template-library-url`

## External Clients

Documents, Reports Service, UserProfiles, Contacts, RelationshipSettings, InvestReporting, CapTablePositions, LegalEntities, BankAccounts, Channels

## Key Business Rules

- Reports require templates (FK relationship)
- Template names must be unique
- System templates marked with `isSystem` flag (protected)
- Binding data handlers process templates with entity data
- Template library stored in S3
