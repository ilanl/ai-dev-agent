---
name: documents-module
description: Documents module domain expert. Document storage, S3 uploads, document owners, collections, managed types, OCR, document events, portal visibility. Use when working in libs/modules/documents-module/ or with document management features.
---
# Documents Module

**Location:** `libs/modules/documents-module/src/`

## Key Entities

- **DocumentEntity** (`DocumentEntityKey`) — id, s3Key (unique), fileName, fileType, documentType, effectiveDate, validityDate, size, portalVisibility, isPublic, metaData, notes, uploadStatus, isDraft, dynamicTypeId
- **DocumentOwnerEntity** (`DocumentOwnerEntityKey`) — id, documentId, ownerUUID, ownerType. Links documents to owners (contacts, positions, etc.)
- **DocumentOwnerSharedWithEntity** — sharing permissions per document owner
- **CollectionEntity** (`CollectionEntityKey`) — id, name (unique). Groups documents into collections
- **CollectionDocumentEntity** — junction for collections and documents
- **CollectionOwnerEntity** — collection ownership
- **DocumentManagedTypeEntity** (`DocumentManagedTypeEntityKey`) — id, name (unique), isSystem, order. Custom or system document types
- **DocumentManagedTypeTranslationEntity** — translations for managed types
- **DocumentOcrEntity** (`DocumentOcrEntityKey`) — id, documentId. OCR data linked to documents
- **TenantInfo** (`TenantInfoKey`)

## Commands

- `save-documents`, `patch-draft-documents`, `delete-documents`
- `set-document-owners`, `patch-document-owners`, `delete-shared-with`
- `get-upload-url`, `get-upload-url-multi`, `get-document-url-by-key`
- `add-document-managed-type`, `delete-document-managed-type`, `patch-document-managed-type`, `update-document-managed-type-order`, `reorder-all-document-managed-types-alphabetically`
- `add-collection`, `patch-collection`, `delete-collections`
- `add-documents-events`, `publish-draft-document-ocr`, `update-document-ocr`
- `convert-esignature-to-document`, `create-reports-batch`, `add-to-queue-mail-job`

## Queries

- `get-document`, `get-documents`, `find-documents`, `find-document-ids`, `get-document-urls`
- `get-document-types`, `get-document-managed-type`, `find-document-managed-type`
- `get-collection`, `find-collections`, `get-unassigned-collections-documents`
- `get-documents-events`, `get-documents-ocr`
- `get-document-managed-type-translations`, `get-language-options`

## External Clients

Documents Service (files), Events Service, Backoffice Service, HelloSign Docs, Report Client

## Key Business Rules

- S3 keys must be unique per document
- Documents can be drafts before publishing
- Portal visibility controlled separately from public access
- Document owners can be multiple entity types
- Managed types can be system (protected) or custom
- Collections group documents with ownership tracking
- OCR data linked to documents for text extraction
