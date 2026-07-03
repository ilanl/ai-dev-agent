---
name: portal-module
description: Portal module domain expert. Investor portal, subscription flows, investment views, document access, payment methods, offerings, analytics, terminology. Use when working in libs/modules/portal-module/ or with investor portal features.
---
# Portal Module

**Location:** `libs/modules/portal-module/src/`

The portal module provides investor-facing (read-mostly) access to investments, documents, and subscription flows.

## Key Entities

- **TenantInfo** (`TenantInfoKey`) — tenant metadata
- **AppCategory** (`AppCategoryEntityKey`) — app category configuration
- **ClientSetting** (`ClientSettingEntityKey`) — client settings
- **PortalTerminology** (`PortalTerminologyEntityKey`) — UI terminology customization

## Feature Areas

- `subscription-flow/` — multi-step subscription process:
  1. Accreditation, 2. Acknowledgments, 3. Attach contacts, 4. Distribution payment method,
  5. Documents, 6. Investing entity, 7. Investment amount, 8. Summary
  Supports smart forms, merge fields, signature documents
- `investor/` — portfolio overview, investment stats, contact updates, electronic K1 consent
- `cap-table-positions/` — position metrics, metadata, custom fields (read-only)
- `distributions/` — investor distribution views, breakdowns, over-time charts
- `capital-calls/` — investor capital call views, breakdowns
- `capital-transactions/` — investor transaction views, breakdowns
- `nav-groups/` — NAV group views for investors
- `net-income-groups/` — net income views for investors
- `documents/` — portal document access, events tracking, public documents
- `fundraising/` — offering views, brochures, data rooms
- `payment-methods/` — Plaid/Clearshift management for investors
- `payments/` — subscription ACH contributions
- `analytics/` — Mixpanel init/identify info
- `settings/` — public/system client settings
- `auth/` — login info, OTP verification, preview user check
- `waterfall/` — waterfall balance viewing

## External Clients

Extensive client integrations spanning CRM, Invest, Fundraising, Documents, Payments, System, Waterfall, Auth, and Emails modules.

## Key Business Rules

- Portal is investor-facing with mostly read-only access
- Subscription flow enforces step ordering and validation
- Smart forms support rules and conditions for field/section visibility
- Payment methods managed via Plaid and Clearshift
- Document access controlled by portal visibility settings
- Feature flags control feature availability per tenant
