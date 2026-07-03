---
name: create-module
description: Create a new NestJS domain module with Clean Architecture layers. Use when creating a new module, domain module, or feature module in libs/modules/.
---
# Create a NestJS Domain Module

## Directory Structure

```
libs/modules/{module-name}-module/src/
├── api/
│   └── controllers/
│       └── {feature}/
│           └── {feature}.controller.ts
├── application/
│   ├── {feature}/
│   │   ├── commands/
│   │   │   └── {action}/
│   │   └── queries/
│   │       └── {action}/
│   └── index.ts              # Exports allQueryHandlers, allCommandHandlers, allServices
├── domain/
│   ├── entities/
│   │   ├── __fixtures__/
│   │   └── index.ts
│   ├── enums/
│   │   └── index.ts
│   ├── constants/
│   │   └── errors.ts
│   ├── interfaces/
│   └── index.ts               # Re-exports from @agorareal/daos + enums + constants
├── infra/
│   ├── providers/
│   │   └── sequelize.provider.ts
│   ├── modules/
│   │   └── config/
│   ├── clients/
│   └── env/
│       └── config/
│           └── config.ts
├── tests/
│   ├── app-test-helper.ts     # getAppMemDB()
│   └── __fixtures__/
├── {module-name}.module.ts     # Main NestJS module
├── main.ts
└── index.ts                    # Public exports
```

## Step-by-Step

### 1. Create the NX Project

Use NX generators or manually create the directory under `libs/modules/`.

### 2. Domain Layer

**`domain/index.ts`** - Re-export entities and constants:
```typescript
export * from './entities';
export * from './enums';
export * from './constants';
```

**`domain/constants/errors.ts`** - Domain error messages:
```typescript
export const errors = {
  entityNotFound: 'Entity not found',
  duplicateEntry: 'Entry already exists',
};
```

**`domain/entities/index.ts`** - Re-export from `@agorareal/daos`:
```typescript
export { MyEntity, IMyEntity, MyEntityKey } from '@agorareal/daos';
```

### 3. Infra Layer

**`infra/providers/sequelize.provider.ts`**:
```typescript
import { AGORA_API_SEQUELIZE, NamedSequelizeConnection, ILoggerKey } from '@agorareal/common';
import { Provider } from '@nestjs/common';
import { allEntities } from '@agorareal/daos';
import { MyEntity, MyEntityKey } from '../../domain';

export const myModuleSequelizeKey = Symbol('MY_MODULE_SEQUELIZE');

export const sequelizeProvider: Provider = {
  provide: myModuleSequelizeKey,
  useFactory: () => {
    const sequelize = NamedSequelizeConnection.getInstance(AGORA_API_SEQUELIZE);
    sequelize.addModels(allEntities);
    return sequelize;
  },
  inject: [ILoggerKey],
};

export const allEntityProviders = [
  { provide: MyEntityKey, useValue: MyEntity },
];
```

### 4. Application Layer

**`application/index.ts`**:
```typescript
import { FeatureQueryHandlers } from './feature/queries';
import { FeatureCommandHandlers } from './feature/commands';

export const allQueryHandlers = [...FeatureQueryHandlers];
export const allCommandHandlers = [...FeatureCommandHandlers];
export const allServices = [];
```

### 5. Module File

**`{module-name}.module.ts`**:
```typescript
import { Module } from '@nestjs/common';
import {
  AuthModule, cognitoConfig, MediatorModule, LoggerModule,
  TenantModule, RootSequelizeModule, AGORA_API_SEQUELIZE,
  RequestContextModule, FeatureFlagsModule,
} from '@agorareal/common';
import { FeatureController } from './api/controllers/feature/feature.controller';
import { allCommandHandlers, allQueryHandlers, allServices } from './application';
import { allEntityProviders } from './infra/providers/sequelize.provider';

@Module({
  imports: [
    AuthModule.register(cognitoConfig),
    TenantModule.forAsyncRoot(),
    MediatorModule,
    LoggerModule.forRoot(),
    RequestContextModule,
  ],
  controllers: [FeatureController],
  providers: [...allQueryHandlers, ...allCommandHandlers, ...allServices, ...allEntityProviders],
})
export class MyApiModule {}
```

### 6. Register in Main App

Add to `apps/agora-api/src/main.ts` AppModule imports:
```typescript
import { MyApiModule } from '@agorareal/my-module';
// In @Module imports array:
MyApiModule,
```

### 7. Test Helper

**`tests/app-test-helper.ts`**:
```typescript
import { Sequelize } from 'sequelize-typescript';
import { createMemDB } from '@agorareal/daos';
import { allEntities } from '@agorareal/daos';

export const getAppMemDB = async (): Promise<Sequelize> => {
  return await createMemDB([...allEntities]);
};
```

### 8. Public Exports

**`index.ts`**:
```typescript
export { MyApiModule } from './{module-name}.module';
```

## Reference

`libs/modules/crm-module/src/crm.module.ts`
