---
name: bookkeeping-module
description: Bookkeeping module domain expert. Transaction management, QuickBooks integration, file uploads, categorization, comments, books management. Use when working in libs/modules/bookkeeping-module/ or with bookkeeping features.
---
# Bookkeeping Module

**Location:** `libs/modules/bookkeeping-module/src/`

## Key Entities

- **AdminAccount** — shared admin account entity

## Commands

- `upload-transaction-files` — upload files to transactions
- `upload-to-documents-server` — forward uploads to documents service
- `update-transaction` — update transaction details
- `update-transaction-categorization` — categorize transactions
- `create-transaction-comment` — add comments to transactions

## Queries

- `get-transactions` — list transactions
- `get-transaction-files` — get files attached to transactions
- `get-agora-categories` — get categorization options
- `get-books` — list QuickBooks connections

## Domain Errors

`adminAccountNotFound`, `youCanOnlyModifyYourOwnComments`, `noFilesProvided`, `uploadFailed`, `transactionFileNotFoundInCache`, `transactionFileKeyNotFound`, `transactionFileUrlNotFound`

## External Clients

- **DocumentsClient** — document management
- **TransactionsClient** — bookkeeping service SDK (transactions CRUD)
- **TransactionCommentsClient** — bookkeeping service SDK (comments)
- **BooksClient** — bookkeeping service SDK (QuickBooks connections)
- **S3UploadService** — S3 file uploads

## Key Business Rules

- Users can only modify their own comments
- File uploads are validated and cached before processing
- Transaction files are stored in S3 and linked via documents service
- Books represent QuickBooks connections per legal entity
