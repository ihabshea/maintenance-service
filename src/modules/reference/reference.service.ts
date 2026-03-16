import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateWorkshopDto, WorkshopScopeDto } from './dto/create-workshop.dto';
import { UpdateWorkshopDto } from './dto/update-workshop.dto';
import { CreateReasonDto } from './dto/create-reason.dto';
import { UpdateReasonDto } from './dto/update-reason.dto';
import {
  ReferenceScope,
  ReasonType,
  ReferenceStatus,
  Workshop,
  Reason,
} from '@prisma/client';
import {
  PaginationQueryDto,
  decodeCursor,
  buildPaginatedResult,
  PaginatedResult,
} from '../../common/dto/pagination.dto';

@Injectable()
export class ReferenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async getWorkshops(
    tenantId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<Workshop>> {
    const limit = query.limit ?? 20;
    const cursorData = query.cursor ? decodeCursor(query.cursor) : null;

    const workshops = await this.prisma.workshop.findMany({
      where: {
        OR: [{ tenantId: null }, { tenantId }],
        status: { not: 'deleted' },
      },
      orderBy: [{ scope: 'asc' }, { name: 'asc' }],
      take: limit + 1,
      ...(cursorData && {
        skip: 1,
        cursor: { id: cursorData.id },
      }),
    });

    return buildPaginatedResult(workshops, limit);
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

  async getReasons(
    tenantId: string,
    reasonType: string | undefined,
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<Reason>> {
    const limit = query.limit ?? 20;
    const cursorData = query.cursor ? decodeCursor(query.cursor) : null;

    const where: {
      OR: Array<{ tenantId: string | null }>;
      status: { not: ReferenceStatus };
      reasonType?: ReasonType;
    } = {
      OR: [{ tenantId: null }, { tenantId }],
      status: { not: 'deleted' as ReferenceStatus },
    };

    if (reasonType) {
      where.reasonType = reasonType as ReasonType;
    }

    const reasons = await this.prisma.reason.findMany({
      where,
      orderBy: [{ scope: 'asc' }, { label: 'asc' }],
      take: limit + 1,
      ...(cursorData && {
        skip: 1,
        cursor: { id: cursorData.id },
      }),
    });

    return buildPaginatedResult(reasons, limit);
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

  async updateWorkshop(
    id: string,
    tenantId: string,
    dto: UpdateWorkshopDto,
    actor: string,
    isSystemAdmin: boolean = false,
  ) {
    const workshop = await this.prisma.workshop.findFirst({
      where: { id, OR: [{ tenantId: null }, { tenantId }] },
    });

    if (!workshop) {
      throw new NotFoundException(`Workshop with id ${id} not found`);
    }

    if (workshop.tenantId === null && !isSystemAdmin) {
      throw new ForbiddenException(
        'System-scoped workshops cannot be modified',
      );
    }

    if (workshop.tenantId !== null && workshop.tenantId !== tenantId) {
      throw new ForbiddenException(
        'You do not have permission to modify this workshop',
      );
    }

    const previousValue = { ...workshop } as unknown as Record<string, unknown>;

    const updated = await this.prisma.workshop.update({
      where: { id },
      data: dto,
    });

    await this.auditService.log({
      tenantId,
      entityType: 'workshop',
      entityId: id,
      action: 'updated',
      actor,
      previousValue,
      newValue: updated as unknown as Record<string, unknown>,
    });

    return updated;
  }

  async deleteWorkshop(
    id: string,
    tenantId: string,
    actor: string,
    isSystemAdmin: boolean = false,
  ) {
    const workshop = await this.prisma.workshop.findFirst({
      where: { id, OR: [{ tenantId: null }, { tenantId }] },
    });

    if (!workshop) {
      throw new NotFoundException(`Workshop with id ${id} not found`);
    }

    if (workshop.tenantId === null && !isSystemAdmin) {
      throw new ForbiddenException(
        'System-scoped workshops cannot be modified',
      );
    }

    if (workshop.tenantId !== null && workshop.tenantId !== tenantId) {
      throw new ForbiddenException(
        'You do not have permission to modify this workshop',
      );
    }

    const updated = await this.prisma.workshop.update({
      where: { id },
      data: { status: 'deleted' },
    });

    await this.auditService.log({
      tenantId,
      entityType: 'workshop',
      entityId: id,
      action: 'deleted',
      actor,
      previousValue: workshop as unknown as Record<string, unknown>,
      newValue: updated as unknown as Record<string, unknown>,
    });

    return updated;
  }

  async updateReason(
    id: string,
    tenantId: string,
    dto: UpdateReasonDto,
    actor: string,
  ) {
    const reason = await this.prisma.reason.findFirst({
      where: { id, OR: [{ tenantId: null }, { tenantId }] },
    });

    if (!reason) {
      throw new NotFoundException(`Reason with id ${id} not found`);
    }

    if (reason.tenantId === null) {
      throw new ForbiddenException('System-scoped reasons cannot be modified');
    }

    if (reason.tenantId !== tenantId) {
      throw new ForbiddenException(
        'You do not have permission to modify this reason',
      );
    }

    const previousValue = { ...reason } as unknown as Record<string, unknown>;

    const updated = await this.prisma.reason.update({
      where: { id },
      data: dto,
    });

    await this.auditService.log({
      tenantId,
      entityType: 'reason',
      entityId: id,
      action: 'updated',
      actor,
      previousValue,
      newValue: updated as unknown as Record<string, unknown>,
    });

    return updated;
  }

  async deleteReason(id: string, tenantId: string, actor: string) {
    const reason = await this.prisma.reason.findFirst({
      where: { id, OR: [{ tenantId: null }, { tenantId }] },
    });

    if (!reason) {
      throw new NotFoundException(`Reason with id ${id} not found`);
    }

    if (reason.tenantId === null) {
      throw new ForbiddenException('System-scoped reasons cannot be modified');
    }

    if (reason.tenantId !== tenantId) {
      throw new ForbiddenException(
        'You do not have permission to modify this reason',
      );
    }

    const updated = await this.prisma.reason.update({
      where: { id },
      data: { status: 'deleted' },
    });

    await this.auditService.log({
      tenantId,
      entityType: 'reason',
      entityId: id,
      action: 'deleted',
      actor,
      previousValue: reason as unknown as Record<string, unknown>,
      newValue: updated as unknown as Record<string, unknown>,
    });

    return updated;
  }
}
