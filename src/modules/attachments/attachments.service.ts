import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateAttachmentDto } from './dto/create-attachment.dto';
import {
  PaginationQueryDto,
  decodeCursor,
  buildPaginatedResult,
  PaginatedResult,
} from '../../common/dto/pagination.dto';
import { MaintenanceAttachment } from '@prisma/client';

@Injectable()
export class AttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async createAttachment(
    tenantId: string,
    taskId: string,
    vehicleId: string,
    dto: CreateAttachmentDto,
    actor: string,
  ) {
    const taskVehicle = await this.prisma.maintenanceTaskVehicle.findFirst({
      where: { tenantId, taskId, vehicleId },
    });

    if (!taskVehicle) {
      throw new NotFoundException(
        `Vehicle ${vehicleId} not found in task ${taskId}`,
      );
    }

    const attachment = await this.prisma.maintenanceAttachment.create({
      data: {
        tenantId,
        taskId,
        vehicleId,
        fileUrl: dto.fileUrl,
        fileType: dto.fileType,
        fileName: dto.fileName,
        contentType: dto.contentType,
        uploadedBy: actor,
      },
    });

    await this.auditService.log({
      tenantId,
      entityType: 'attachment',
      entityId: attachment.id,
      action: 'created',
      actor,
      newValue: attachment as unknown as Record<string, unknown>,
    });

    return attachment;
  }

  async getAttachments(
    tenantId: string,
    taskId: string,
    vehicleId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<MaintenanceAttachment>> {
    const limit = query.limit ?? 20;
    const cursorData = query.cursor ? decodeCursor(query.cursor) : null;

    const taskVehicle = await this.prisma.maintenanceTaskVehicle.findFirst({
      where: { tenantId, taskId, vehicleId },
    });

    if (!taskVehicle) {
      throw new NotFoundException(
        `Vehicle ${vehicleId} not found in task ${taskId}`,
      );
    }

    const attachments = await this.prisma.maintenanceAttachment.findMany({
      where: { tenantId, taskId, vehicleId },
      orderBy: { uploadedAt: 'desc' },
      take: limit + 1,
      ...(cursorData && {
        skip: 1,
        cursor: { id: cursorData.id },
      }),
    });

    return buildPaginatedResult(attachments, limit);
  }
}
