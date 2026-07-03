---
name: create-command
description: Create a CQRS command with handler, DTOs, validator, tests, and barrel exports. Use when creating a new command, command handler, or implementing a write operation in a module.
---
# Create a CQRS Command

## Folder & File Structure

Place under `application/{feature}/commands/{object}-{action}/`:

```
{object}-{action}/
├── {object}-{action}.command.ts                  # Command class + CommandHandler
├── {object}-{action}.command.request.dto.ts       # Request DTO
├── {object}-{action}.command.response.dto.ts      # Response DTO
├── {object}-{action}.command.validator.ts          # Joi validator
├── {object}-{action}.command.spec.ts              # Handler tests
├── {object}-{action}.command.validator.spec.ts    # Validator tests
└── index.ts                                        # Barrel exports
```

## Step-by-Step

### 1. Request DTO

```typescript
// {object}-{action}.command.request.dto.ts
import { IMyEntity } from '../../../../domain';

export class CreateThingCommandRequestDto implements Omit<IMyEntity, 'id'> {
  name: string;
  description?: string;
}
```

- Implement/extend entity interfaces when applicable
- Use `@ApiProperty({ enum: MyEnum, enumName: 'MyEnum' })` only on enum fields

### 2. Response DTO

```typescript
// {object}-{action}.command.response.dto.ts
import { IMyEntity } from '../../../../domain';

export class CreateThingCommandResponseDto implements IMyEntity {
  id: string;
  name: string;
  description?: string;
}
```

### 3. Command + Handler

```typescript
// {object}-{action}.command.ts
import { Command, CommandHandler, ICommandHandler, ILogger, ILoggerKey } from '@agorareal/common';
import { Inject } from '@nestjs/common';
import { MyEntityKey, MyEntity } from '../../../../domain';
import { CreateThingCommandRequestDto } from './create-thing.command.request.dto';
import { CreateThingCommandResponseDto } from './create-thing.command.response.dto';

export class CreateThingCommand extends Command<CreateThingCommandResponseDto> {
  constructor(public readonly request: CreateThingCommandRequestDto) {
    super();
  }
}

@CommandHandler(CreateThingCommand)
export class CreateThingCommandHandler implements ICommandHandler<CreateThingCommand> {
  constructor(
    @Inject(MyEntityKey) private readonly myEntity: typeof MyEntity,
    @Inject(ILoggerKey) private readonly logger: ILogger,
  ) {}

  async execute(command: CreateThingCommand): Promise<CreateThingCommandResponseDto> {
    try {
      const { name, description } = command.request;
      const created = await this.myEntity.create({ name, description });
      return { id: created.id, name: created.name, description: created.description };
    } catch (err) {
      this.logger.error('[CreateThingCommandHandler]', { err: err.message, stack: err.stack });
      throw err;
    }
  }
}
```

Key patterns:
- Inject entities via Symbol keys (`@Inject(MyEntityKey)`)
- Always inject `ILogger` via `ILoggerKey`
- Use error classes from `@agorareal/common` (e.g., `NotFoundException`, `CallerException`)
- Import error messages from `domain/constants/errors.ts`

### 4. Validator

```typescript
// {object}-{action}.command.validator.ts
import Joi from 'joi';
import { Validator } from '@agorareal/common';
import { CreateThingCommandRequestDto } from './create-thing.command.request.dto';

export class CreateThingCommandValidator extends Validator<CreateThingCommandRequestDto> {
  readonly schema = Joi.object<CreateThingCommandRequestDto>({
    name: Joi.string().required(),
    description: Joi.string().optional().allow(null, ''),
  });
}
```

- Schema MUST exactly match DTO: required fields → `.required()`, optional → `.optional()`, nullable → `.allow(null)`
- No generic on top-level `Joi.object` (avoids circular dep)

### 5. Barrel Export

```typescript
// index.ts
export * from './{object}-{action}.command.request.dto';
export * from './{object}-{action}.command.response.dto';
export * from './{object}-{action}.command';
export * from './{object}-{action}.command.validator';
```

### 6. Register the Handler

1. Add handler to `commands/index.ts` in the feature folder:
   ```typescript
   import { CreateThingCommandHandler } from './create-thing/create-thing.command';
   export const ThingsCommandHandlers = [...existingHandlers, CreateThingCommandHandler];
   ```

2. Ensure the feature's command handlers are spread into `application/index.ts` → `allCommandHandlers`.

3. Ensure `allCommandHandlers` is in the module's `providers` array.

### 7. Tests

See the `write-unit-tests` skill for test patterns. The spec file should:
- Use `getAppMemDB()` for in-memory DB
- Create related data with fixtures
- Test success and error paths
- Cleanup with `afterEach(() => memDb.truncate())` and `afterAll(() => memDb.close())`

## Reference Implementation

`libs/modules/crm-module/src/application/organizations/commands/create-organization-contact/`
