import { Controller, Get, Post, Body, Query, Headers } from '@nestjs/common';
import { ApiTags, ApiHeader } from '@nestjs/swagger';
import { ReferenceService } from './reference.service';
import {
  CreateWorkshopDto,
  CreateSystemWorkshopDto,
  WorkshopScopeDto,
} from './dto/create-workshop.dto';
import { CreateReasonDto } from './dto/create-reason.dto';
import { ReasonsQueryDto } from './dto/query.dto';
import { TenantId, Actor } from '../../common/decorators';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

@ApiTags('Reference Data')
@ApiHeader({ name: 'X-Tenant-Id', required: true })
@Controller('reference')
export class ReferenceController {
  constructor(private readonly referenceService: ReferenceService) {}

  @Get('workshops')
  async getWorkshops(
    @TenantId() tenantId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.referenceService.getWorkshops(tenantId, query);
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
  async getReasons(
    @TenantId() tenantId: string,
    @Query() query: ReasonsQueryDto,
  ) {
    return this.referenceService.getReasons(tenantId, query.type, query);
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
