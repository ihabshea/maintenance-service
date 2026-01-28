import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { MinioService } from './minio.service';
import { Upload } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly minioService: MinioService,
  ) {}

  async uploadFile(
    tenantId: string,
    file: Express.Multer.File,
    actor: string,
  ): Promise<Upload> {
    const uploadId = uuidv4();
    const sanitizedFileName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const objectKey = `${tenantId}/${uploadId}-${sanitizedFileName}`;

    await this.minioService.uploadFile(objectKey, file.buffer, file.mimetype);

    const fileUrl = this.minioService.getFileUrl(objectKey);

    const upload = await this.prisma.upload.create({
      data: {
        id: uploadId,
        tenantId,
        objectKey,
        fileUrl,
        fileName: file.originalname,
        contentType: file.mimetype,
        fileSize: file.size,
        uploadedBy: actor,
      },
    });

    await this.auditService.log({
      tenantId,
      entityType: 'upload',
      entityId: upload.id,
      action: 'created',
      actor,
      newValue: {
        id: upload.id,
        fileName: upload.fileName,
        contentType: upload.contentType,
        fileSize: Number(upload.fileSize),
      },
    });

    return upload;
  }

  async claimUpload(tenantId: string, fileUrl: string): Promise<void> {
    const upload = await this.prisma.upload.findFirst({
      where: { tenantId, fileUrl },
    });

    if (!upload) {
      this.logger.warn(`Upload not found for URL: ${fileUrl}`);
      return;
    }

    if (upload.claimedAt) {
      this.logger.warn(`Upload already claimed: ${upload.id}`);
      return;
    }

    await this.prisma.upload.update({
      where: { id: upload.id },
      data: { claimedAt: new Date() },
    });

    this.logger.log(`Claimed upload: ${upload.id}`);
  }

  async findUnclaimedOlderThan(hours: number): Promise<Upload[]> {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);

    return this.prisma.upload.findMany({
      where: {
        claimedAt: null,
        createdAt: { lt: cutoff },
      },
    });
  }

  async deleteUpload(upload: Upload): Promise<void> {
    await this.minioService.deleteFile(upload.objectKey);

    await this.prisma.upload.delete({
      where: { id: upload.id },
    });

    await this.auditService.log({
      tenantId: upload.tenantId,
      entityType: 'upload',
      entityId: upload.id,
      action: 'deleted',
      actor: 'system',
      previousValue: {
        id: upload.id,
        fileName: upload.fileName,
        reason: 'orphan_cleanup',
      },
    });

    this.logger.log(`Deleted orphaned upload: ${upload.id}`);
  }
}
