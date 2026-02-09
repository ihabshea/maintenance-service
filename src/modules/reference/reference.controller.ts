import { Controller, Get, Post, Patch, Delete, Body, Query, Headers, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiHeader, ApiBody } from '@nestjs/swagger';
import { ReferenceService } from './reference.service';
import {
  CreateWorkshopDto,
  WorkshopScopeDto,
} from './dto/create-workshop.dto';
import { CreateReasonDto } from './dto/create-reason.dto';
import { UpdateWorkshopDto } from './dto/update-workshop.dto';
import { UpdateReasonDto } from './dto/update-reason.dto';
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
  @ApiBody({ type: CreateWorkshopDto })
  async createWorkshop(
    @TenantId() tenantId: string,
    @Actor() actor: string,
    @Body() dto: CreateWorkshopDto,
    @Headers('x-system-admin') isSystemAdmin?: string,
  ) {
    const isAdmin = isSystemAdmin === 'true';
    const scope = (dto as any).scope ?? WorkshopScopeDto.tenant;

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

  @Patch('workshops/:id')
  async updateWorkshop(
    @TenantId() tenantId: string,
    @Actor() actor: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWorkshopDto,
  ) {
    const workshop = await this.referenceService.updateWorkshop(
      id,
      tenantId,
      dto,
      actor,
    );
    return { data: workshop };
  }

  @Delete('workshops/:id')
  async deleteWorkshop(
    @TenantId() tenantId: string,
    @Actor() actor: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const workshop = await this.referenceService.deleteWorkshop(
      id,
      tenantId,
      actor,
    );
    return { data: workshop };
  }

  @Patch('reasons/:id')
  async updateReason(
    @TenantId() tenantId: string,
    @Actor() actor: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReasonDto,
  ) {
    const reason = await this.referenceService.updateReason(
      id,
      tenantId,
      dto,
      actor,
    );
    return { data: reason };
  }

  @Delete('reasons/:id')
  async deleteReason(
    @TenantId() tenantId: string,
    @Actor() actor: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const reason = await this.referenceService.deleteReason(
      id,
      tenantId,
      actor,
    );
    return { data: reason };
  }
}
