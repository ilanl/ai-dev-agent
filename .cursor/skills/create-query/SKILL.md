---
name: create-query
description: Create a CQRS query with handler, DTOs, tests, and barrel exports. Use when creating a new query, query handler, or implementing a read operation in a module.
---
# Create a CQRS Query

## Folder & File Structure

Place under `application/{feature}/queries/{object}-{action}/`:

```
{object}-{action}/
├── {object}-{action}.query.ts                  # Query class + QueryHandler
├── {object}-{action}.query.request.dto.ts       # Request DTO
├── {object}-{action}.query.response.dto.ts      # Response DTO
├── {object}-{action}.query.spec.ts              # Handler tests
└── index.ts                                      # Barrel exports
```

## Step-by-Step

### 1. Request DTO

```typescript
// {object}-{action}.query.request.dto.ts
export class GetThingByIdQueryRequestDto {
  id: string;
}
```

For queries with filters/paging:
```typescript
export class GetThingsQueryRequestDto_Filters {
  ids?: string[];
  status?: string;
}

export class GetThingsQueryRequestDto {
  filters?: GetThingsQueryRequestDto_Filters;
  page?: number;
  pageSize?: number;
}
```

### 2. Response DTO

```typescript
// {object}-{action}.query.response.dto.ts
import { IMyEntity } from '../../../../domain';

export class GetThingByIdQueryResponseDto implements IMyEntity {
  id: string;
  name: string;
}
```

For list queries, include paging:
```typescript
import { PagingResponseDto } from '@agorareal/common';

export class GetThingsQueryResponseDto {
  data: ThingDto[];
  paging: PagingResponseDto;
}
```

### 3. Query + Handler

```typescript
// {object}-{action}.query.ts
import { Query, QueryHandler, IQueryHandler, ILogger, ILoggerKey, NotFoundException } from '@agorareal/common';
import { Inject } from '@nestjs/common';
import { MyEntityKey, MyEntity } from '../../../../domain';
import { GetThingByIdQueryRequestDto } from './get-thing-by-id.query.request.dto';
import { GetThingByIdQueryResponseDto } from './get-thing-by-id.query.response.dto';

export class GetThingByIdQuery extends Query<GetThingByIdQueryResponseDto> {
  constructor(public dto: GetThingByIdQueryRequestDto) {
    super();
  }
}

@QueryHandler(GetThingByIdQuery)
export class GetThingByIdQueryHandler implements IQueryHandler<GetThingByIdQuery> {
  constructor(
    @Inject(MyEntityKey) private readonly myEntity: typeof MyEntity,
    @Inject(ILoggerKey) private logger: ILogger,
  ) {}

  async execute({ dto }: GetThingByIdQuery): Promise<GetThingByIdQueryResponseDto> {
    try {
      const entity = await this.myEntity.findByPk(dto.id);
      if (!entity) {
        throw new NotFoundException('Thing not found');
      }
      return { id: entity.id, name: entity.name };
    } catch (err) {
      this.logger.warn('[GetThingByIdQueryHandler]', { err: err.message, stack: err.stack });
      throw err;
    }
  }
}
```

Key patterns:
- Queries do NOT have validators (only commands do)
- Use `NotFoundException` for missing resources
- Destructure `{ dto }` from query in `execute()`
- Use Sequelize `include` for eager loading related entities

### 4. Barrel Export

```typescript
// index.ts
export * from './{object}-{action}.query';
export * from './{object}-{action}.query.request.dto';
export * from './{object}-{action}.query.response.dto';
```

### 5. Register the Handler

1. Add handler to `queries/index.ts`:
   ```typescript
   import { GetThingByIdQueryHandler } from './get-thing-by-id/get-thing-by-id.query';
   export const ThingsQueryHandlers = [...existingHandlers, GetThingByIdQueryHandler];
   ```

2. Ensure the feature's query handlers are spread into `application/index.ts` → `allQueryHandlers`.

3. Ensure `allQueryHandlers` is in the module's `providers` array.

### 6. Tests

See the `write-unit-tests` skill. The spec file should:
- Use `getAppMemDB()` for in-memory DB
- Create test data with fixtures
- Mock `Mediator` if the handler calls other queries/commands
- Test success and not-found/error paths

## Reference Implementation

`libs/modules/crm-module/src/application/organizations/queries/get-organization-details/`
