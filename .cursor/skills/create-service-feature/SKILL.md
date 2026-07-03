---
name: create-service-feature
description: Create a feature in a multi-tenant microservice under apps/services/. Use when adding commands, queries, endpoints, or features to a multi-tenant service.
---
# Create a Feature in a Multi-Tenant Service

Services in `apps/services/` follow similar patterns to domain modules but with multi-tenancy and service-specific infrastructure.

## Architecture

Most services follow Clean Architecture:
```
apps/services/{service-name}/src/
├── api/controllers/        # REST endpoints
├── application/            # Commands, queries, services
│   └── {feature}/
│       ├── commands/
│       └── queries/
├── domain/                 # Entities, interfaces, constants
├── infra/                  # Config, clients, providers, queue subscribers
└── main.ts                 # Bootstrap
```

## Key Differences from Domain Modules

### 1. Multi-Tenancy
Services are multi-tenant. Use `TenantGuard` and tenant-aware patterns:
```typescript
@UseGuards(TenantGuard)
@Controller('/my-feature')
export class MyController { ... }
```

### 2. Internal API Keys
Services are internal-only, accessed via API keys from v2 backend or other services:
```typescript
@UseGuards(InternalApiKeyGuard)
```

### 3. Decorators
Services may use `@Transactional()` and `@Validate()` decorators on commands:
```typescript
import { Transactional, Validate } from '@agorareal/common';

@Transactional()
@Validate(MyCommandValidator)
export class MyCommand extends Command<void> {
  constructor(public readonly dto: MyDto) { super(); }
}
```

### 4. Queue Subscribers
Services often consume RabbitMQ messages:
```typescript
import { RabbitSubscriber } from '@agorareal/common';

export class MySubscriber extends RabbitSubscriber {
  constructor(config: IRabbitSubscriberConfig, logger: ILogger) {
    super(config, logger);
  }

  async handleMessage(msg: ConsumeMessage): Promise<void> {
    const payload = JSON.parse(msg.content.toString());
    // Process message
  }
}
```

### 5. Service Configuration
Each service has its own env config in `infra/env/config/config.ts`:
```typescript
export const envConfig: IConfig = {
  appName: process.env.SERVICE_NAME || 'my-service',
  port: parseInt(process.env.PORT || '8888'),
  db: { connection: { host, database, username, password, port } },
  rabbitInbound: { rabbitUrl, exchange, routingKey },
};
```

## Creating a Feature

### 1. Command/Query
Follow the same CQRS pattern as domain modules (see `create-command` and `create-query` skills).

### 2. Controller Endpoint
```typescript
@Controller('/my-feature')
export class MyController {
  constructor(readonly mediator: Mediator) {}

  @Post()
  @HttpCode(200)
  create(@Body() dto: CreateDto): Promise<ResponseDto> {
    return this.mediator.execute(new CreateCommand(dto));
  }
}
```

### 3. Entity Registration
Service entities follow the same Sequelize pattern. Register in the service's provider file.

### 4. Handler Registration
Add handlers to the service's module providers, following the same barrel export pattern as domain modules.

## Per-Service Skills

Each service has its own domain skill with detailed entity relationships, business rules, and integration patterns. Check for a matching `{service-name}` skill before making changes to a service.
