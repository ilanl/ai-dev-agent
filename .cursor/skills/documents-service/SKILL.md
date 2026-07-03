---
name: documents-service
description: Documents service domain expert. S3 file management, presigned URLs, file upload/download, multi-tenant bucket support. Use when working in apps/services/documents-service/.
---
# Documents Service

**Location:** `apps/services/documents-service/src/`
**Port:** 7777, **Prefix:** `api-documents`

## Architecture

Lightweight stateless service for S3 file operations. No Sequelize entities.

## API Endpoints

- `POST /files/upload/presign` — get presigned upload URLs
- `POST /files/urls` — get presigned download URLs for multiple files
- `POST /files/delete` — delete files from S3

## External Integrations

- **AWS S3** — file storage, presigned URL generation

## Key Business Rules

- Tenant isolation via bucket names (via `storage-bucket-name` header)
- S3 bucket validation before operations
- Presigned URL generation for secure uploads/downloads
- Batch file operations supported
- No database entities — purely S3 operations
