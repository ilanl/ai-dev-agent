---
name: invest-module
description: Investment module domain expert. Legal entities, cap table positions, classes, distributions, capital calls, capital transactions, commitments, NAV, net income, waterfall, ownership, tax center, DRIP, Yardi integration. Use when working in libs/modules/invest-module/ or with investment-related features.
---
# Invest Module

**Location:** `libs/modules/invest-module/src/`

The largest module in the system, handling all investment management operations.

## Key Entities (from @agorareal/daos)

- **LegalEntity** — id, name, the fund/investment vehicle. Has classes, positions, assets
- **ClassEntity** — id, name, legalEntityId. Equity or debt class within a legal entity
- **CapTablePosition** — id, legalEntityId, classId, userProfileId. An investor's position in a class
- **CommitmentEntity** — id, positionId, amount. Investor's committed capital
- **CapitalTransaction** — id, positionId, type (contribution/distribution/etc), amount, effectiveDate
- **CapitalTransactionType** — custom transaction types with priority ordering
- **CapitalAllocationType** — allocation type definitions
- **DistributionEntity** — id, legalEntityId, status. Cash distribution events
- **SubDistributionEntity** — per-position distribution allocations
- **CapitalCallEntity** — id, legalEntityId, status. Capital call events
- **SubCapitalCallEntity** — per-position capital call allocations
- **NavGroupEntity** / **NavPositionEntity** / **NavComponentEntity** — NAV estimates
- **NetIncomeGroupEntity** / **NetIncomePositionEntity** / **NetIncomeTypeEntity** — net income passthroughs
- **OwnershipMetricEntity** — ownership metric definitions (commitment, contribution, unit, percentage)
- **ManualOwnershipTransactionEntity** — manual ownership adjustments
- **InputBalanceEntity** — waterfall input balances
- **LegalEntityAsset** — real estate/assets linked to legal entities
- **LegalEntityTaxGroupEntity** — tax group definitions

## Key Relationships

- LegalEntity 1:N Class 1:N Position
- Position N:1 UserProfile (investor)
- Position 1:N Commitment, CapitalTransaction
- Distribution/CapitalCall → SubDistribution/SubCapitalCall (per position)
- Class supports: equity, debt, unit-based ownership

## Domain Errors

Extremely extensive error constants organized by: common, assets, legalEntities, userProfiles, classes, positions, ownershipTransfers, commitments, capitalTransactions, capitalTransactionTypes, capitalAllocationTypes, distributions, subDistributions, capitalCalls, subCapitalCalls, navs, netIncomes, ownershipMetrics, unitValues, waterfall, drip, tax, promissoryNotes

## External Clients

Waterfall Calculator, Waterfall Configuration, Documents, Collections, Currencies, Pre-Processing (job dispatch), Client Settings, Custom Fields, Payment Owners

## Feature Areas

- `legal-entities/` — CRUD, images, tags, unit values, Yardi settings
- `classes/` — CRUD, tax groups, default allocations
- `cap-table-positions/` — CRUD, merge, move, reassign, 1031 exchange, metrics
- `commitments/` — CRUD, calculations, ownership
- `capital-transactions/` — CRUD, breakdown, metrics, import
- `distributions/` — CRUD, publish/unpublish, settle payments, waterfall tiers
- `capital-calls/` — CRUD, publish/unpublish, breakdown, metrics
- `navs/` — NAV groups, positions, components, pro-rata allocation
- `net-incomes/` — types, bases, groups, positions, pro-rata allocation
- `ownership/` — transfers, manual transactions, ownership calculations
- `waterfall/` — save/trigger waterfall, export breakdown
- `tax-center/` — K1 documents, tax reports, signature requests
- `assets/` — acquisitions, dispositions, documents
- `data-points/` — custom data points for legal entities
- `yardi-settings/` — Yardi integration configuration
