---
name: payments-module
description: Payments module domain expert. Payment methods (Plaid, Clearshift, Wire, Check, ABA, ACH), GP bank accounts, payment batches, payment ledgers, businesses, international contributions, distribution payments. Use when working in libs/modules/payments-module/ or with payment-related features.
---
# Payments Module

**Location:** `libs/modules/payments-module/src/`

## Key Entities (from @agorareal/daos)

- **PaymentEntity** (ManualPaymentEntity) — manual payment records
- **PaymentsLedgerEntity** — payment status tracking (ACH payments)
- **PaymentsOwnerEntity** — payment owner association
- **BankAccountEntity** — investor bank accounts
- **PaymentMethodPlaidEntity** — Plaid-connected bank accounts
- **PaymentMethodClearshiftEntity** — Clearshift international accounts
- **PaymentMethodWireEntity** — wire transfer details
- **PaymentMethodCheckEntity** — check payment details
- **PaymentMethodABAEntity** — ABA routing details
- **PaymentMethodACHEntity** — ACH transfer details
- **GpBankAccountEntity** — GP (General Partner) bank accounts
- **GpBankAccountLegalEntityEntity** — GP bank account to legal entity mapping
- **PaymentsBatchEntity** — batch payment operations

## Feature Areas

- `payment-method/` — CRUD for all payment method types (Plaid, Clearshift, Wire, Check, ABA, ACH)
- `gp-bank-accounts/` — GP bank account management with Plaid, signatory management
- `bank-accounts/` — attach/detach bank accounts to positions
- `manual-payments/` — create/upsert manual payments
- `batches/` — payment batch creation and export
- `distribution/` — ACH distribution payments, settlement
- `contribution/` — ACH contribution payments
- `international-contribution/` — Clearshift deal orders, counterparties
- `plaid/` — Plaid link management, webhook handling
- `clearshift/` — Clearshift bank account management, document uploads
- `business/` — Unit business accounts, entities
- `payments-ledger/` — payment status tracking and reset
- `thread-account/` — Thread account actions (deposit, transfer, withdraw)
- `settings/` — currency settings

## External Integrations

Plaid (banking), Clearshift (international), Unit (business banking), Thread (account management), Documents Service, Currencies Service

## Domain Errors

`paymentMethodPlaidNotFound`, `failedToCreateClearshiftBankAccount`, `paymentLedgerAlreadyConnectedToPaymentOwner`, `cannotDeletePaymentMethod`, `businessNotFound`, `businessAlreadyHasAccount`, `subDistributionNotFound`, `cannotSettleSubDistributionsWithAgoraPayments`, plus many more payment-specific errors.
