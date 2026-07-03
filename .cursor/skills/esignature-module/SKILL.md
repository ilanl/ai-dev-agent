---
name: esignature-module
description: E-signature module domain expert. HelloSign/Dropbox Sign templates, form fields, signature requests, template rules, form values. Use when working in libs/modules/esignature-module/ or with e-signature features.
---
# E-Signature Module

**Location:** `libs/modules/esignature-module/src/`

## Key Entities (from @agorareal/daos)

- **HsTemplateEntity** (`HsTemplateEntityKey`) — id, hsTemplateId. E-signature templates
- **HsTemplateFormEntity** (`HsTemplateFormEntityKey`) — forms within templates
- **HsTemplateFormSectionEntity** (`HsTemplateFormSectionEntityKey`) — sections within forms
- **HsTemplateFormFieldEntity** (`HsTemplateFormFieldEntityKey`) — individual form fields
- **HsTemplateProfileTypeEntity** (`HsTemplateProfileTypeEntityKey`) — profile type associations
- **HsTemplateRuleEntity** (`HsTemplateRuleEntityKey`) — conditional rules for templates
- **HsFormEntity** (`HsFormEntityKey`) — form instances
- **HsFormFieldValueEntity** (`HsFormFieldValueEntityKey`) — submitted form field values
- **SignatureRequestEntity** (`SignatureRequestEntityKey`) — id, hsSignatureRequestId. Signature request tracking
- **SignatureEntity** (`SignatureEntityKey`) — individual signatures within requests
- **SignatureRequestGroupEntity** (`SignatureRequestGroupEntityKey`) — groups of signature requests

## Relationships

- HsTemplate 1:N HsTemplateForm 1:N HsTemplateFormSection 1:N HsTemplateFormField
- HsTemplate 1:N HsTemplateRule
- SignatureRequestGroup 1:N SignatureRequest 1:N Signature

## Commands

- Template CRUD: `create-hs-template`, `create-hs-template-draft`, `duplicate-hs-template`, `copy-hs-template`, `update-hs-template`, `delete-hs-template`
- Form values: `upsert-hs-form-values`, `delete-hs-form-values`, `delete-hs-form-values-change-requests`
- Signature: `initiate-signature-request-with-template`, `initiate-signature-request-with-template-form`, `remove-signature-requests`
- Rules: `create-hs-template-rule`, `update-hs-template-rules`, `remove-hs-template-rule-conditions`

## Queries

- `get-hs-templates`, `get-hs-template`, `get-hs-template-file`, `get-hs-template-edit-url`
- `get-hs-form-values`, `get-signature-request-groups`, `count-signature-requests`, `get-embedded-sign-url`

## External Integrations

Dropbox Sign API (HelloSign), AI Template Builder Service

## Key Business Rules

- Templates can be drafts before publishing
- Form fields validate based on field type (text, checkbox, checkbox-group)
- Template rules control visibility based on profile type, residency, and form values
- Signature requests are grouped for batch processing
- Signature status tracking: completed, declined, awaiting signatures, awaiting countersign
