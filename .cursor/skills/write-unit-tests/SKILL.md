---
name: write-unit-tests
description: Write unit tests for command handlers, query handlers, and validators. Use when writing tests, spec files, unit tests, or testing CQRS handlers.
---
# Write Unit Tests

## Test File Location

Place `*.spec.ts` files in the same folder as the handler/validator being tested.

## Command/Query Handler Tests

```typescript
import { ILogger } from '@agorareal/common';
import { mock, MockProxy } from 'vitest-mock-extended';
import { Sequelize } from 'sequelize-typescript';

import { MyEntity, RelatedEntity } from '../../../../domain';
import { relatedFixture } from '../../../../domain/entities/__fixtures__/related';
import { getAppMemDB } from '../../../../tests/app-test-helper';

import { CreateThingCommand, CreateThingCommandHandler } from './create-thing.command';

describe('CreateThingCommandHandler', () => {
  let handler: CreateThingCommandHandler;
  let memDb: Sequelize;
  let loggerMock: MockProxy<ILogger>;

  beforeEach(async () => {
    loggerMock = mock<ILogger>();
    memDb = await getAppMemDB();
    handler = new CreateThingCommandHandler(MyEntity, loggerMock);
  });

  afterEach(() => {
    memDb.truncate();
  });

  afterAll(() => memDb.close());

  it('should create successfully', async () => {
    const related = await RelatedEntity.create(relatedFixture());

    const command = new CreateThingCommand({
      name: 'Test',
      relatedId: related.id,
    });
    const result = await handler.execute(command);

    expect(result).toMatchObject({ name: 'Test' });
    expect(result.id).toBeDefined();

    const dbRecord = await MyEntity.findByPk(result.id);
    expect(dbRecord).not.toBeNull();
  });

  it('should throw on invalid input', async () => {
    const command = new CreateThingCommand({ name: '', relatedId: 'nonexistent' });
    await expect(handler.execute(command)).rejects.toThrow();
  });
});
```

## Key Patterns

### Database Setup
- Use `getAppMemDB()` from `tests/app-test-helper.ts` for in-memory SQLite
- NEVER mock the main entity being tested — use real Sequelize models
- Create all required related data using fixtures before testing

### Mocking
- Use `vitest-mock-extended` for vitest modules, `jest-mock-extended` for jest modules
- Mock: `ILogger`, `Mediator`, external API clients, auth validators
- Do NOT mock: entities, database, fixtures

```typescript
import { mock, MockProxy } from 'vitest-mock-extended';
import { ILogger, Mediator } from '@agorareal/common';

let loggerMock: MockProxy<ILogger>;
let mediatorMock: MockProxy<Mediator>;

beforeEach(() => {
  loggerMock = mock<ILogger>();
  mediatorMock = mock<Mediator>();
  mediatorMock.execute.mockResolvedValue({ /* mock response */ });
});
```

### Fixtures
- Located in `domain/entities/__fixtures__/` or `application/{feature}/__fixtures__/`
- Fixture functions return data with optional overrides:
  ```typescript
  const entity = await MyEntity.create(myFixture({ name: 'Override' }));
  ```

### Cleanup
```typescript
afterEach(() => { memDb.truncate(); });
afterAll(() => memDb.close());
```

### Handler Instantiation
Pass real entity classes and mocks directly to constructor:
```typescript
handler = new CreateThingCommandHandler(MyEntity, loggerMock);
// or with mediator:
handler = new GetThingQueryHandler(MyEntity, loggerMock, mediatorMock);
```

## Validator Tests

Keep minimal (3-4 tests). Test pass/fail only.

```typescript
import { expectValidationError, expectValidationSuccess } from '@agorareal/common';

describe('MyCommandValidator', () => {
  const validator = new MyCommandValidator();

  it('should pass with valid input', () => {
    expectValidationSuccess(validator, { name: 'valid', id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' });
  });

  it('should fail without required fields', () => {
    expectValidationError(validator, {});
  });

  it('should fail with invalid UUID', () => {
    expectValidationError(validator, { id: 'not-a-uuid' });
  });
});
```

## What to Test

1. **Success path** - valid input produces expected output, verify DB state
2. **Error/not-found paths** - missing data throws appropriate exceptions
3. **Edge cases** - duplicate entries, null/optional fields
4. **Both return value and DB state** - verify the handler wrote to DB correctly

## Reference

`libs/modules/crm-module/src/application/organizations/commands/create-organization-contact/create-organization-contact.command.spec.ts`
