import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateWorkshopDto, WorkshopScopeDto } from './dto/create-workshop.dto';
import { CreateReasonDto } from './dto/create-reason.dto';
import { ReferenceScope, ReasonType, ReferenceStatus } from '@prisma/client';

@Injectable()
export class ReferenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async getWorkshops(tenantId: string) {
    return this.prisma.workshop.findMany({
      where: {
        OR: [{ tenantId: null }, { tenantId }],
        status: 'active',
      },
      orderBy: [{ scope: 'asc' }, { name: 'asc' }],
    });
  }

  async getWorkshopById(id: string, tenantId: string) {
    const workshop = await this.prisma.workshop.findFirst({
      where: {
        id,
        OR: [{ tenantId: null }, { tenantId }],
      },
    });

    if (!workshop) {
      throw new NotFoundException(`Workshop with id ${id} not found`);
    }

    return workshop;
  }

  async createWorkshop(
    tenantId: string,
    dto: CreateWorkshopDto,
    actor: string,
    isSystemAdmin: boolean = false,
    scope: WorkshopScopeDto = WorkshopScopeDto.tenant,
  ) {
    const workshopScope: ReferenceScope =
      isSystemAdmin && scope === WorkshopScopeDto.system ? 'system' : 'tenant';
    const workshopTenantId = workshopScope === 'system' ? null : tenantId;

    const workshop = await this.prisma.workshop.create({
      data: {
        scope: workshopScope,
        tenantId: workshopTenantId,
        name: dto.name,
        location: dto.location,
        status: 'active',
      },
    });

    await this.auditService.log({
      tenantId,
      entityType: 'workshop',
      entityId: workshop.id,
      action: 'created',
      actor,
      newValue: workshop as unknown as Record<string, unknown>,
    });

    return workshop;
  }

  async getReasons(tenantId: string, reasonType?: string) {
    const where: {
      OR: Array<{ tenantId: string | null }>;
      status: ReferenceStatus;
      reasonType?: ReasonType;
    } = {
      OR: [{ tenantId: null }, { tenantId }],
      status: 'active',
    };

    if (reasonType) {
      where.reasonType = reasonType as ReasonType;
    }

    return this.prisma.reason.findMany({
      where,
      orderBy: [{ scope: 'asc' }, { label: 'asc' }],
    });
  }

  async getReasonById(id: string, tenantId: string) {
    const reason = await this.prisma.reason.findFirst({
      where: {
        id,
        OR: [{ tenantId: null }, { tenantId }],
      },
    });

    if (!reason) {
      throw new NotFoundException(`Reason with id ${id} not found`);
    }

    return reason;
  }

  async createReason(tenantId: string, dto: CreateReasonDto, actor: string) {
    const reason = await this.prisma.reason.create({
      data: {
        scope: 'tenant',
        tenantId,
        reasonType: dto.reasonType as ReasonType,
        label: dto.label,
        status: 'active',
      },
    });

    await this.auditService.log({
      tenantId,
      entityType: 'reason',
      entityId: reason.id,
      action: 'created',
      actor,
      newValue: reason as unknown as Record<string, unknown>,
    });

    return reason;
  }
}
