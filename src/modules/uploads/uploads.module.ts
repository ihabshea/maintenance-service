import { Module } from '@nestjs/common';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';
import { MinioService } from './minio.service';
import { UploadsCleanupService } from './uploads-cleanup.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [UploadsController],
  providers: [UploadsService, MinioService, UploadsCleanupService],
  exports: [UploadsService],
})
export class UploadsModule {}
