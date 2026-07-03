# LangGraph Tools — Reference

## Client SDK Layout

Client SDKs are generated from OpenAPI specs. Each module has:

```
libs/modules/{module}-module/src/client-sdk/
├── src/
│   ├── services/           # Client classes (e.g. ContactsClient.ts)
│   ├── models/             # Request/response DTOs
│   ├── core/               # OpenAPI, request, CancelablePromise
│   └── index.ts            # Barrel exports
└── package.json            # @agorareal/{module}-client-sdk
```

### Service File Pattern

Each `*Client.ts` file contains static methods that call `__request(OpenAPI, { method, url, path?, query?, body? })`:

```typescript
// Path param example
public static getContactDetails(contactId: string): CancelablePromise<GetContactDetailsResponseDto> {
  return __request(OpenAPI, {
    method: 'GET',
    url: '/v2/crm/contacts/{contactId}/details',
    path: { contactId },
  });
}

// Body DTO example
public static getContacts(requestBody: GetContactListQueryRequestDto): CancelablePromise<GetContactListResponseDto> {
  return __request(OpenAPI, {
    method: 'POST',
    url: '/v2/crm/contacts/list',
    body: requestBody,
    mediaType: 'application/json',
  });
}
```

### URL Path Conventions

- Base: `/v2/{module}/{resource}/...`
- Path params: `{paramName}` in URL, `path: { paramName }` in request
- Query params: `query: { paramName }`
- Body: `body: requestBody`, `mediaType: 'application/json'`

## DTO Patterns

### Request DTOs

- **Query/Command Request**: `{Action}{Object}QueryRequestDto` or `{Action}{Object}CommandRequestDto`
- **Filter DTOs**: Often nested, e.g. `GetContactListQueryFilterDto` inside `GetContactListQueryRequestDto`
- **Paging**: `PagingRequestDto` with `page`, `pageSize`

### Response DTOs

- **Query Response**: `{Action}{Object}QueryResponseDto` or `{Action}{Object}ResponseDto`
- **Command Response**: `{Action}{Object}CommandResponseDto`
- **Paginated**: `{ data: T[], total: number, paging?: PagingResponse }`

### Field Name Mapping

When building request from Zod input, some DTOs use different names:

| Zod input | DTO field |
|-----------|-----------|
| `filters.statuses` | `filters.statusTypes` |
| `filters.managerIds` | `filters.adminIds` |

Check the DTO type definition before building the request.

## Domain-to-Module Mapping

| Domain | Module | Clients in LangGraph |
|--------|--------|----------------------|
| crm | crm-module | ContactsClient, OrganizationsClient |
| fundraising | fundraising-module | OfferingsClient, ProspectsClient, SubscriptionsClient |
| invest | invest-module | CapTablePositionsClient, DistributionsClient, CapitalCallsClient, LegalEntitiesClient |
| documents | documents-module | DocumentsClient |
| emails | emails-module | DraftsClient, EmailTemplatesClient |
| payments | payments-module | BankAccountsClient, GpBankAccountsClient, PaymentsBatchesClient |

## buildRequest Helper Pattern

For complex request DTOs with nested filters, use a typed helper:

```typescript
import type { GetContactListQueryRequestDto } from '@agorareal/crm-client-sdk';

function buildRequest(input: z.infer<typeof getContactsInputSchema>): GetContactListQueryRequestDto {
  const filters = input.filters
    ? {
        search: input.filters.search,
        contactTypes: input.filters.contactTypes,
        statusTypes: input.filters.statuses,  // note: statuses -> statusTypes
        tagIds: input.filters.tagIds,
        adminIds: input.filters.managerIds,  // note: managerIds -> adminIds
        organizationIds: input.filters.organizationIds,
      }
    : undefined;
  return {
    filters,
    orderBy: input.orderBy,
    orderDirection: input.orderDirection,
    paging: input.paging,
    isAll: input.isAll,
  } as GetContactListQueryRequestDto;
}
```

## Response Mapping Pattern

When the API response shape differs from what the LLM needs, map in the tool:

```typescript
() =>
  LegalEntitiesClient.getLegalEntities(requestBody).then((result) => ({
    legalEntities: result.legalEntities.map((e) => ({
      id: e.id,
      legalName: e.legalName,
      currency: e.currency,
      status: e.statusId,
    })),
    total: result.totalEntities,
  }))
```

## Packages Used by LangGraph

From `apps/langgraph-server/package.json` and `sdk-client.ts`:

- `@agorareal/crm-client-sdk`
- `@agorareal/documents-client-sdk`
- `@agorareal/emails-client-sdk`
- `@agorareal/fundraising-client-sdk`
- `@agorareal/invest-client-sdk`
- `@agorareal/payments-client-sdk`

Other modules (auth, esignature, system, etc.) have client SDKs but are not wired into langgraph-server. Do not add tools for those unless the SDK is first added to sdk.ts and sdk-client.ts.
