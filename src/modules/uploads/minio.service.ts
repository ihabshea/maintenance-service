import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';

@Injectable()
export class MinioService implements OnModuleInit {
  private readonly logger = new Logger(MinioService.name);
  private client: Minio.Client;
  private bucketName: string;

  constructor(private readonly configService: ConfigService) {
    this.bucketName = this.configService.get<string>(
      'MINIO_BUCKET_NAME',
      'maintenance-uploads',
    );

    this.client = new Minio.Client({
      endPoint: this.configService.get<string>('MINIO_ENDPOINT', 'localhost'),
      port: this.configService.get<number>('MINIO_PORT', 9000),
      useSSL:
        this.configService.get<string>('MINIO_USE_SSL', 'false') === 'true',
      accessKey: this.configService.get<string>(
        'MINIO_ACCESS_KEY',
        'minioadmin',
      ),
      secretKey: this.configService.get<string>(
        'MINIO_SECRET_KEY',
        'minioadmin123',
      ),
    });
  }

  async onModuleInit() {
    const endpoint = this.configService.get<string>('MINIO_ENDPOINT', 'localhost');
    if (endpoint === 'disabled') {
      this.logger.warn('MinIO is disabled — file uploads will not work');
      return;
    }
    await this.ensureBucketExists();
  }

  private async ensureBucketExists(): Promise<void> {
    try {
      const exists = await this.client.bucketExists(this.bucketName);
      if (!exists) {
        await this.client.makeBucket(this.bucketName);
        this.logger.log(`Created bucket: ${this.bucketName}`);
      }
    } catch (error) {
      this.logger.error(`Failed to ensure bucket exists: ${error.message}`);
      throw error;
    }
  }

  async uploadFile(
    objectKey: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<void> {
    await this.client.putObject(
      this.bucketName,
      objectKey,
      buffer,
      buffer.length,
      {
        'Content-Type': contentType,
      },
    );
  }

  async deleteFile(objectKey: string): Promise<void> {
    await this.client.removeObject(this.bucketName, objectKey);
  }

  getFileUrl(objectKey: string): string {
    const endpoint = this.configService.get<string>(
      'MINIO_ENDPOINT',
      'localhost',
    );
    const port = this.configService.get<number>('MINIO_PORT', 9000);
    const useSSL =
      this.configService.get<string>('MINIO_USE_SSL', 'false') === 'true';
    const protocol = useSSL ? 'https' : 'http';
    return `${protocol}://${endpoint}:${port}/${this.bucketName}/${objectKey}`;
  }

  getBucketName(): string {
    return this.bucketName;
  }
}
