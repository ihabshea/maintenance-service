import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { UploadsService } from './uploads.service';

@Injectable()
export class UploadsCleanupService {
  private readonly logger = new Logger(UploadsCleanupService.name);
  private readonly retentionHours: number;

  constructor(
    private readonly uploadsService: UploadsService,
    private readonly configService: ConfigService,
  ) {
    this.retentionHours = this.configService.get<number>(
      'UPLOAD_RETENTION_HOURS',
      24,
    );
  }

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupOrphanedUploads(): Promise<void> {
    this.logger.log('Starting orphaned uploads cleanup');

    try {
      const orphanedUploads = await this.uploadsService.findUnclaimedOlderThan(
        this.retentionHours,
      );

      this.logger.log(
        `Found ${orphanedUploads.length} orphaned uploads to delete`,
      );

      for (const upload of orphanedUploads) {
        try {
          await this.uploadsService.deleteUpload(upload);
        } catch (error) {
          this.logger.error(
            `Failed to delete upload ${upload.id}: ${error.message}`,
          );
        }
      }

      this.logger.log('Orphaned uploads cleanup completed');
    } catch (error) {
      this.logger.error(`Cleanup job failed: ${error.message}`);
    }
  }
}
