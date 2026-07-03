---
name: bookkeeping-service
description: Bookkeeping service domain expert. QuickBooks OAuth integration, transaction management, categorization, AI workflows, sync operations, financial reports. Use when working in apps/services/bookkeeping-service/.
---
# Bookkeeping Service

**Location:** `apps/services/bookkeeping-service/src/`
**Port:** 8888, **Prefix:** `api-bookkeeping-service`

## Entities

- **QuickBooksBookEntity** — id (UUID), tenantId, name, realmId. Represents a QB connection
- **QuickBooksConnectionEntity** — id, bookId, accessToken, refreshToken, realmId, isActive
- **QuickBooksAccountEntity** — id, bookId, quickbooksAccountId, name, accountType
- **QuickBooksCustomerEntity** — id, bookId, quickbooksCustomerId, name
- **QuickBooksTransactionEntity** — id, bookId, quickbooksTransactionId, transactionDate, transactionType, name, accountId, amount
- **QuickBooksTransactionFileEntity** — links files to transactions
- **TransactionCategorizationEntity** — categorization records
- **TransactionCommentEntity** — comments on transactions
- **TransactionAiExecutionEntity** — AI workflow executions
- **BookQbSyncConfigEntity** — sync configuration
- **BookFilterAccountEntity** — account filtering
- **BookAiSyncConfigEntity** — AI sync configuration
- **AgoraCategoryEntity** — Agora-defined categories

## API Endpoints

### Transactions (`/transactions`)
- `GET /transactions/book/:bookId`, `GET /transactions/:transactionId`
- `GET /transactions/categories`, `GET /transactions/files/:fileId/download-url`
- `PUT /transactions/:transactionId/categorization`, `PATCH /transactions/:transactionId`

### QuickBooks (`/quickbooks`)
- `POST /quickbooks/authorize`, `GET /quickbooks/callback` — OAuth flow
- `GET/DELETE /quickbooks/connection/:bookId`
- `POST /quickbooks/sync/:bookId`, `POST /quickbooks/sync-accounts/:bookId`, `POST /quickbooks/sync-transactions/:bookId`
- `GET /quickbooks/transactions/:bookId`, `GET /quickbooks/accounts/:bookId`, `GET /quickbooks/customers/:bookId`
- Reports: `GET /quickbooks/trial-balance/:bookId`, `GET /quickbooks/balance-sheet/:bookId`, `GET /quickbooks/profit-and-loss/:bookId`, `GET /quickbooks/general-ledger/:bookId`

### Books, Comments, Sync Configs
- CRUD for books, transaction comments, and sync configurations

## External Integrations

- **QuickBooks API** — OAuth 2.0, account/customer/transaction sync, financial reports
- **AWS S3** — transaction file storage
- **AI Services** — transaction categorization (search-internet, ml-model, agora-match)

## Key Business Rules

- OAuth 2.0 flow for QuickBooks connections with token refresh
- Books concept: `(tenantId, legalEntityId)` enables multiple QB connections per tenant
- Transaction categorization supports manual and AI-powered workflows
- Account filtering for selective sync
- Financial report generation: trial balance, balance sheet, P&L, general ledger
