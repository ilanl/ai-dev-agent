---
name: create-entity
description: Create a Sequelize entity with interface, Symbol key, fixtures, and provider registration. Use when creating a new database model, data entity, or table in the ORM layer.
---
# Create a Sequelize Entity

Entities live in `libs/packages/daos/src/{domain}/` and are registered in module providers.

## Step-by-Step

### 1. Create the Entity File

Location: `libs/packages/daos/src/{domain}/{entity-name}.entity.ts`

```typescript
import { Column, DataType, Model, Table, ForeignKey, BelongsTo } from 'sequelize-typescript';
import { Optional } from 'sequelize';

export const MyEntityKey = Symbol('MyEntityKey');

export interface IMyEntity {
  id: string;
  name: string;
  status: MyStatus;
  parentId: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ICreateMyEntity extends Optional<IMyEntity, 'id'> {}

@Table({ tableName: 'my_table_name', timestamps: true })
export class MyEntity extends Model<IMyEntity, ICreateMyEntity> implements IMyEntity {
  @Column({ type: DataType.UUID, defaultValue: DataType.UUIDV4, primaryKey: true })
  id: string;

  @Column({ allowNull: false, type: DataType.STRING })
  name: string;

  @Column({ allowNull: false, type: DataType.ENUM(...Object.values(MyStatus)) })
  status: MyStatus;

  @ForeignKey(() => ParentEntity)
  @Column({ allowNull: true, type: DataType.UUID })
  parentId: string | null;

  @BelongsTo(() => ParentEntity)
  parent?: ParentEntity;
}
```

Key patterns:
- Symbol key for DI: `export const MyEntityKey = Symbol('MyEntityKey')`
- Interface `IMyEntity` + create interface `ICreateMyEntity extends Optional<IMyEntity, 'id'>`
- Model extends `Model<IMyEntity, ICreateMyEntity> implements IMyEntity`
- Nullable fields use `Type | null` and `allowNull: true`
- Enums: `DataType.ENUM(...Object.values(MyEnum))`
- UUIDs: `DataType.UUID` with `defaultValue: DataType.UUIDV4`

### 2. Export from Domain Barrel

Add to `libs/packages/daos/src/{domain}/index.ts`:
```typescript
export { MyEntity, IMyEntity, ICreateMyEntity, MyEntityKey } from './my-entity.entity';
```

### 3. Add to allEntities

Add the entity to `libs/packages/daos/src/all-entities.ts` so Sequelize discovers it.

### 4. Re-export from Module Domain

In the consuming module's `domain/entities/index.ts` or `domain/index.ts`, re-export:
```typescript
export { MyEntity, IMyEntity, ICreateMyEntity, MyEntityKey } from '@agorareal/daos';
```

### 5. Register as Provider

In the module's `infra/providers/sequelize.provider.ts`, add to `allEntityProviders`:
```typescript
import { MyEntity, MyEntityKey } from '../../domain';

// Inside allEntityProviders array:
{ provide: MyEntityKey, useValue: MyEntity },
```

### 6. Create Test Fixture

In `libs/packages/daos/src/{domain}/__fixtures__/` or the module's `__fixtures__/`:

```typescript
import { IMyEntity } from '../my-entity.entity';

export const myEntityFixture = (overrides?: Partial<IMyEntity>): IMyEntity => ({
  id: 'test-uuid-1',
  name: 'Test Entity',
  status: MyStatus.Active,
  parentId: null,
  ...overrides,
});
```

### 7. Add Enums (if needed)

Place in `libs/packages/daos/src/{domain}/enums.ts` or the module's `domain/enums/`:
```typescript
export enum MyStatus {
  Active = 'Active',
  Inactive = 'Inactive',
}
```

## Common DataTypes

| TypeScript | Sequelize DataType |
|---|---|
| `string` | `DataType.STRING` or `DataType.TEXT` |
| `string` (UUID) | `DataType.UUID` |
| `number` | `DataType.INTEGER` or `DataType.DECIMAL(19, 7)` |
| `boolean` | `DataType.BOOLEAN` |
| `Date` | `DataType.DATE` |
| `enum` | `DataType.ENUM(...Object.values(MyEnum))` |
| `JSON` | `DataType.JSONB` or `DataType.JSON` |

## Common Associations

| Relationship | Decorator |
|---|---|
| Many-to-one | `@ForeignKey(() => Parent)` + `@BelongsTo(() => Parent)` |
| One-to-many | `@HasMany(() => Child)` |
| Many-to-many | `@BelongsToMany(() => Other, { through: () => JoinTable })` |

## Reference

`libs/packages/daos/src/crm/contact.entity.ts`
