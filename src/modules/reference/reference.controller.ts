import { Controller, Get, Post, Body, Query, Headers } from '@nestjs/common';
import { ApiTags, ApiHeader, ApiQuery } from '@nestjs/swagger';
import { ReferenceService } from './reference.service';
import {
  CreateWorkshopDto,
  CreateSystemWorkshopDto,
  WorkshopScopeDto,
} from './dto/create-workshop.dto';
import { CreateReasonDto } from './dto/create-reason.dto';
import { TenantId, Actor } from '../../common/decorators';

@ApiTags('Reference Data')
@ApiHeader({ name: 'X-Tenant-Id', required: true })
@Controller('reference')
export class ReferenceController {
  constructor(private readonly referenceService: ReferenceService) {}

  @Get('workshops')
  async getWorkshops(@TenantId() tenantId: string) {
    const workshops = await this.referenceService.getWorkshops(tenantId);
    return { data: workshops };
  }

  @Post('workshops')
  @ApiHeader({ name: 'X-System-Admin', required: false })
  async createWorkshop(
    @TenantId() tenantId: string,
    @Actor() actor: string,
    @Body() dto: CreateWorkshopDto | CreateSystemWorkshopDto,
    @Headers('x-system-admin') isSystemAdmin?: string,
  ) {
    const isAdmin = isSystemAdmin === 'true';
    const scope = 'scope' in dto ? dto.scope : WorkshopScopeDto.tenant;

    const workshop = await this.referenceService.createWorkshop(
      tenantId,
      dto,
      actor,
      isAdmin,
      scope,
    );
    return { data: workshop };
  }

  @Get('reasons')
  @ApiQuery({ name: 'type', required: false, enum: ['cancellation'] })
  async getReasons(@TenantId() tenantId: string, @Query('type') type?: string) {
    const reasons = await this.referenceService.getReasons(tenantId, type);
    return { data: reasons };
  }

  @Post('reasons')
  async createReason(
    @TenantId() tenantId: string,
    @Actor() actor: string,
    @Body() dto: CreateReasonDto,
  ) {
    const reason = await this.referenceService.createReason(
      tenantId,
      dto,
      actor,
    );
    return { data: reason };
  }
}
