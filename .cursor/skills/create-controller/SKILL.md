---
name: create-controller
description: Create a NestJS API controller with endpoints, guards, and Swagger annotations. Use when creating controllers, API endpoints, routes, or REST endpoints.
---
# Create an API Controller

Controllers live in `api/controllers/{feature}/` within a module.

## Controller Template

```typescript
import { JwtGuard, Mediator } from '@agorareal/common';
import {
  Controller, HttpCode, UseGuards, Post, Get, Patch, Delete,
  Body, Param, Query, UsePipes, ValidationPipe,
} from '@nestjs/common';
import { ApiTags, ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import {
  AdminPermissionsGuard, AdminPermissions, CRM_EDIT_PERMISSION,
} from '@agorareal/acp-permissions-module';

import {
  GetThingsQuery, GetThingsQueryRequestDto, GetThingsQueryResponseDto,
} from '../../../application/things/queries/get-things';
import {
  CreateThingCommand, CreateThingCommandRequestDto, CreateThingCommandResponseDto,
} from '../../../application/things/commands/create-thing';

@Controller('/my-module/things')
@UseGuards(JwtGuard)
@ApiTags('things')
export class ThingsController {
  constructor(readonly mediator: Mediator) {}

  @Post('list')
  @HttpCode(200)
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOkResponse({ type: GetThingsQueryResponseDto })
  @ApiOperation({ operationId: 'getThings' })
  getThings(@Body() dto: GetThingsQueryRequestDto): Promise<GetThingsQueryResponseDto> {
    return this.mediator.execute(new GetThingsQuery(dto));
  }

  @Post('create')
  @HttpCode(200)
  @UseGuards(AdminPermissionsGuard)
  @AdminPermissions(CRM_EDIT_PERMISSION)
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOkResponse({ type: CreateThingCommandResponseDto })
  @ApiOperation({ operationId: 'createThing' })
  createThing(@Body() dto: CreateThingCommandRequestDto): Promise<CreateThingCommandResponseDto> {
    return this.mediator.execute(new CreateThingCommand(dto));
  }

  @Get(':id')
  @HttpCode(200)
  @ApiOkResponse({ type: GetThingResponseDto })
  @ApiOperation({ operationId: 'getThingById' })
  getById(@Param('id') id: string): Promise<GetThingResponseDto> {
    return this.mediator.execute(new GetThingByIdQuery({ id }));
  }

  @Patch(':id')
  @HttpCode(200)
  @UseGuards(AdminPermissionsGuard)
  @AdminPermissions(CRM_EDIT_PERMISSION)
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOkResponse({ type: UpdateThingResponseDto })
  @ApiOperation({ operationId: 'updateThing' })
  update(@Param('id') id: string, @Body() dto: UpdateThingRequestDto): Promise<UpdateThingResponseDto> {
    return this.mediator.execute(new UpdateThingCommand(id, dto));
  }
}
```

## Key Patterns

### Mediator
Controllers use `Mediator` to dispatch commands/queries. Never put business logic in controllers.

### Guards
- `@UseGuards(JwtGuard)` - class-level for auth
- `@UseGuards(AdminPermissionsGuard)` + `@AdminPermissions(PERMISSION)` - method-level for write operations

### Swagger
- `@ApiTags('feature-name')` on class
- `@ApiOkResponse({ type: ResponseDto })` on each method
- `@ApiOperation({ operationId: 'uniqueOperationName' })` on each method (used for SDK generation)
- `@ApiProperty` only on enum fields in DTOs

### Request Handling
- `@Body()` for POST/PATCH/PUT request bodies
- `@Param('id')` for URL parameters
- `@Query('name')` for query string parameters
- `@UsePipes(new ValidationPipe({ transform: true }))` for auto-validation

### List Endpoints
Use `@Post('list')` with `@HttpCode(200)` for list/filter operations (body contains filters).

## Registration

1. Add controller to the module's `controllers` array in `{module}.module.ts`
2. Export from `api/index.ts` barrel file

## Reference

`libs/modules/crm-module/src/api/controllers/contacts/contacts.controller.ts`
