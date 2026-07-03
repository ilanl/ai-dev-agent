---
name: waterfall-module
description: Waterfall module domain expert. Waterfall distribution configurations, tier types (Preferred Return, IRR, Catch-Up, Equity Multiples, Return of Capital, Split, Remaining Proceeds), class allocations, side letters, skippings. Use when working in libs/modules/waterfall-module/ or with waterfall calculations.
---
# Waterfall Module

**Location:** `libs/modules/waterfall-module/src/`

## Key Entities (from @agorareal/daos)

- **WaterfallConfigurationEntity** — id, legalEntityId (unique). The top-level waterfall config per legal entity
- **WaterfallTierEntity** — id, waterfallConfigurationId. Individual tiers (Preferred Return, IRR, etc.)
- **WaterfallTierClassesEntity** — class-level allocation within tiers
- **WaterfallClassesEntity** — classes participating in the waterfall
- **WaterfallTiersSkippingsEntity** — tier skipping rules
- **WaterfallTiersSideLettersEntity** — side letter overrides per tier
- **WaterfallTierYearsRateEntity** — year-specific rates for step-up tiers

## Commands

- `create-or-update-waterfall-configuration` — full waterfall config CRUD
- `delete-waterfall-configuration`

## Queries

- `get-waterfall-configuration`, `get-waterfall-entities`
- `validate-waterfall-configuration`, `validate-waterfall-tier-permutations/side-letters/skippings/intervals`
- `get-whitelisted-waterfall-configurations`
- `calculate-class-allocation-amounts`
- `get-waterfall-breakdown`, `get-waterfall-balances`, `get-waterfall-formulas`
- `run-waterfall`, `run-waterfall-simulator`, `run-waterfall-for-legal-entity`
- `get-waterfall-distribution`

## Domain Errors (extensive)

Covers: configuration validation, tier type ordering, sequential numbers, compound intervals, recipient validation, class allocation sums, side letter restrictions, tier-specific rules (IRR, Preferred Return, Catch-Up, etc.)

## Key Business Rules

- Remaining Proceeds tier must be present and last
- Catch-up tiers must be preceded by Preferred Return, Return of Capital, or IRR
- Multiple tiers of the same type cannot have identical percentages or same recipients
- Compound intervals must be >= update intervals
- Class allocations must sum to 100%
- Side letters not allowed for class-based waterfalls
- IRR update interval must be NONE or DAY
- Step-Up with First Investment Date not allowed with IRR
