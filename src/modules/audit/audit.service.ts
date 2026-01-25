import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditEntityType, Prisma } from '@prisma/client';

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
  ) {
    return this.prisma.maintenanceAuditLog.findMany({
      where: {
        tenantId,
        entityType,
        entityId,
      },
      orderBy: {
        timestamp: 'desc',
      },
    });
  }
}
