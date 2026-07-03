---
name: automation-module
description: Automation module domain expert. Workflow automations, triggers, conditions, actions for offerings and subscriptions. Use when working in libs/modules/automation-module/ or with automation features.
---
# Automation Module

**Location:** `libs/modules/automation-module/src/`

## Key Entities

- **AutomationEntity** (`AutomationEntityKey`) — id, ownerType, ownerId, name, trigger, condition (JSON), action (JSON), orderIndex, isSystem, isActive
  - Unique constraint: `(ownerType, ownerId, orderIndex)` — unique priority per owner

## Commands

- `create-automations`, `update-automation`, `delete-automations`

## Queries

- `get-automation`, `get-automations`

## Domain Errors

`maximumRequestLimitReached`

## Enums

- **AutomationOwnerType**: `OFFERINGS`
- **AutomationTrigger**: `SUBSCRIPTION_PROFILE_SELECTED`, `INVESTMENT_AMOUNT_SET`, `READY_FOR_COUNTER_SIGN`, `SIGNATURES_SIGNED_BY_ALL_PARTIES`, `SIGNATURE_RESET`, `SUBSCRIPTION_RESET`
- **AutomationConditionOperator**: `EQUALS`, `NOT_EQUALS`, `GREATER_THAN`, `LESS_THAN`, `CONTAINS`, `NOT_CONTAINS`, `IS`, `IS_NOT`
- **AutomationConditionGroupOperator**: `AND`, `OR`

## Key Business Rules

- OrderIndex must be unique per (ownerType, ownerId) — enforces priority ordering
- Cannot create duplicate automations with same trigger and action.value for the same owner
- Conditions use a group structure with AND/OR operators
- Actions are JSON-defined, enabling flexible automation behaviors
