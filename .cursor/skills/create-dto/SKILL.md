---
name: create-dto
description: Create DTOs for commands or queries with proper Swagger annotations. Use when creating request DTOs, response DTOs, data transfer objects, or API contracts.
---
# Create DTOs

DTOs are classes (not interfaces) because Swagger/OpenAPI generates SDKs from them.

## Naming Conventions

| Type | File Name | Class Name |
|---|---|---|
| Request | `{folder}.{command/query}.request.dto.ts` | `{FolderPascal}{Command/Query}RequestDto` |
| Response | `{folder}.{command/query}.response.dto.ts` | `{FolderPascal}{Command/Query}ResponseDto` |
| Nested | (same file as parent) | `{ParentName}_{PropName}` |

Example for folder `get-portal-user`:
- File: `get-portal-user.query.request.dto.ts`
- Classes: `GetPortalUserQueryRequestDto`, `GetPortalUserQueryRequestDto_Filters`

## Request DTO

```typescript
import { IMyEntity } from '../../../../domain';

export class CreateThingCommandRequestDto implements Omit<IMyEntity, 'id'> {
  name: string;
  description?: string;
  status: MyStatus;
}
```

For queries with filters:
```typescript
export class GetThingsQueryRequestDto_Filters {
  ids?: string[];
  status?: MyStatus;
}

export class GetThingsQueryRequestDto {
  filters?: GetThingsQueryRequestDto_Filters;
  page?: number;
  pageSize?: number;
}
```

## Response DTO

```typescript
import { IMyEntity } from '../../../../domain';

export class CreateThingCommandResponseDto implements IMyEntity {
  id: string;
  name: string;
  description?: string;
}
```

For list responses with paging:
```typescript
import { PagingResponseDto } from '@agorareal/common';

export class GetThingsQueryResponseDto_Item {
  id: string;
  name: string;
}

export class GetThingsQueryResponseDto {
  data: GetThingsQueryResponseDto_Item[];
  paging: PagingResponseDto;
}
```

## Swagger Annotations

Only use `@ApiProperty` on enum fields:

```typescript
import { ApiProperty } from '@nestjs/swagger';

export class MyDto {
  name: string;  // no decorator needed

  @ApiProperty({ enum: MyStatus, enumName: 'MyStatus' })
  status: MyStatus;
}
```

Do NOT add `@ApiProperty` to non-enum fields.

## Rules

- DTOs are classes, never plain interfaces or types
- Implement/extend entity interfaces when applicable
- Keep nested DTOs in the same file using the `{Parent}_{Prop}` naming
- Optional fields use `?` suffix
- Nullable fields use `Type | null`
- Import shared DTOs from `@agorareal/common` (e.g., `PagingResponseDto`, `PagingRequestDto`)
