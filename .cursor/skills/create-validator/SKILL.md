---
name: create-validator
description: Create a Joi validator for a CQRS command with matching tests. Use when creating request validation, Joi schema, or validator classes for commands.
---
# Create a Joi Validator

Validators validate command request DTOs. Queries do NOT have validators.

## Validator File

Location: same folder as the command, named `{object}-{action}.command.validator.ts`

```typescript
import Joi from 'joi';
import { Validator } from '@agorareal/common';
import { CreateThingCommandRequestDto } from './create-thing.command.request.dto';

export class CreateThingCommandValidator extends Validator<CreateThingCommandRequestDto> {
  readonly schema = Joi.object<CreateThingCommandRequestDto>({
    name: Joi.string().min(1).max(255).required(),
    description: Joi.string().optional().allow(null, ''),
    status: Joi.string().valid(...Object.values(MyStatus)).required(),
    parentId: Joi.string().uuid().optional().allow(null),
    tags: Joi.array().items(Joi.string()).optional(),
    filters: Joi.object<FiltersDto>({
      ids: Joi.array().items(Joi.string().uuid()).optional(),
    }).optional(),
  });
}
```

## Critical: DTO Alignment

Schema MUST exactly match the DTO structure:
- Required DTO fields → `.required()`
- Optional DTO fields → `.optional()`
- Nullable DTO fields → `.allow(null)`
- `string | null` → `.allow(null)`
- `string?` → `.optional()`

Always read the request DTO before writing the validator.

## Common Joi Methods

| Type | Method |
|---|---|
| UUID | `Joi.string().uuid()` |
| Email | `Joi.string().email()` |
| String | `Joi.string().min(n).max(n)` |
| Integer | `Joi.number().integer().min(1)` |
| Boolean | `Joi.boolean()` |
| Array | `Joi.array().items(Joi.type())` |
| Object | `Joi.object<Type>({...})` |
| Enum | `Joi.string().valid(...Object.values(MyEnum))` |
| Date | `Joi.date().iso()` |

## Validator Tests

File: `{object}-{action}.command.validator.spec.ts`

Keep tests minimal (3-4 tests). Only test pass/fail, no message assertions.

```typescript
import { expectValidationError, expectValidationSuccess } from '@agorareal/common';
import { CreateThingCommandValidator } from './create-thing.command.validator';
import { CreateThingCommand } from './create-thing.command';

describe('CreateThingCommandValidator', () => {
  const validator = new CreateThingCommandValidator();

  it('should validate valid input', () => {
    expectValidationSuccess(validator, { name: 'Test', status: 'Active' });
  });

  it('should require name', () => {
    expectValidationError(validator, { status: 'Active' });
  });

  it('should reject invalid UUID', () => {
    expectValidationError(validator, { name: 'Test', parentId: 'not-uuid' });
  });
});
```

## Using @Validate Decorator

Commands can be auto-validated using the `@Validate` decorator:

```typescript
import { Validate } from '@agorareal/common';
import { CreateThingCommandValidator } from './create-thing.command.validator';

@Validate(CreateThingCommandValidator)
export class CreateThingCommand extends Command<ResponseDto> {
  constructor(public readonly dto: RequestDto) { super(); }
}
```

## Reference

`libs/modules/esignature-module/src/application/hs-signature-requests/queries/get-signature-requests/get-signature-requests.query.validator.ts`
