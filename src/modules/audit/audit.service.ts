import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditEntityType, Prisma } from '@prisma/client';
import {
  PaginatedResult,
  PaginationQueryDto,
  buildPaginatedResult,
  decodeCursor,
} from '../../common/dto/pagination.dto';

export interface AuditLogEntry {
  tenantId: string;
  entityType: AuditEntityType;
  entityId: string;
  action: string;
  actor: string;
  previousValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditLogEntry): Promise<void> {
    await this.prisma.maintenanceAuditLog.create({
      data: {
        tenantId: entry.tenantId,
        entityType: entry.entityType,
        entityId: entry.entityId,
        action: entry.action,
        actor: entry.actor,
        previousValue: entry.previousValue as Prisma.InputJsonValue | undefined,
        newValue: entry.newValue as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async logMany(entries: AuditLogEntry[]): Promise<void> {
    await this.prisma.maintenanceAuditLog.createMany({
      data: entries.map((entry) => ({
        tenantId: entry.tenantId,
        entityType: entry.entityType,
        entityId: entry.entityId,
        action: entry.action,
        actor: entry.actor,
        previousValue: entry.previousValue as Prisma.InputJsonValue | undefined,
        newValue: entry.newValue as Prisma.InputJsonValue | undefined,
      })),
    });
  }

  async getEntityAuditLog(
    tenantId: string,
    entityType: AuditEntityType,
    entityId: string,
    query: PaginationQueryDto,
    fromDate?: string,
    toDate?: string,
  ): Promise<PaginatedResult<{ id: string; [key: string]: unknown }>> {
    const limit = query.limit ?? 20;
    const cursorData = query.cursor ? decodeCursor(query.cursor) : null;

    const timestampFilter: Record<string, Date> = {};
    if (fromDate) {
      timestampFilter.gte = new Date(fromDate);
    }
    if (toDate) {
      const end = new Date(toDate);
      end.setUTCHours(23, 59, 59, 999);
      timestampFilter.lte = end;
    }

    const entries = await this.prisma.maintenanceAuditLog.findMany({
      where: {
        tenantId,
        entityType,
        entityId,
        ...(Object.keys(timestampFilter).length > 0 && {
          timestamp: timestampFilter,
        }),
      },
      orderBy: {
        timestamp: 'desc',
      },
      take: limit + 1,
      ...(cursorData && {
        skip: 1,
        cursor: { id: cursorData.id },
      }),
    });

    return buildPaginatedResult(entries, limit);
  }
}
