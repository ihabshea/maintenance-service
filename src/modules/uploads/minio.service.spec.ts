import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MinioService } from './minio.service';

jest.mock('minio', () => ({
  Client: jest.fn().mockImplementation(() => ({
    bucketExists: jest.fn(),
    makeBucket: jest.fn(),
    putObject: jest.fn(),
    removeObject: jest.fn(),
  })),
}));

describe('MinioService', () => {
  let service: MinioService;
  let mockMinioClient: any;

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue: any) => {
      const config: Record<string, any> = {
        MINIO_ENDPOINT: 'localhost',
        MINIO_PORT: 9000,
        MINIO_USE_SSL: 'false',
        MINIO_ACCESS_KEY: 'minioadmin',
        MINIO_SECRET_KEY: 'minioadmin123',
        MINIO_BUCKET_NAME: 'test-bucket',
      };
      return config[key] ?? defaultValue;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MinioService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<MinioService>(MinioService);
    mockMinioClient = (service as any).client;
  });

  describe('onModuleInit', () => {
    it('should create bucket if it does not exist', async () => {
      mockMinioClient.bucketExists.mockResolvedValue(false);
      mockMinioClient.makeBucket.mockResolvedValue(undefined);

      await service.onModuleInit();

      expect(mockMinioClient.bucketExists).toHaveBeenCalledWith('test-bucket');
      expect(mockMinioClient.makeBucket).toHaveBeenCalledWith('test-bucket');
    });

    it('should not create bucket if it already exists', async () => {
      mockMinioClient.bucketExists.mockResolvedValue(true);

      await service.onModuleInit();

      expect(mockMinioClient.bucketExists).toHaveBeenCalledWith('test-bucket');
      expect(mockMinioClient.makeBucket).not.toHaveBeenCalled();
    });

    it('should throw error if bucket check fails', async () => {
      mockMinioClient.bucketExists.mockRejectedValue(
        new Error('Connection failed'),
      );

      await expect(service.onModuleInit()).rejects.toThrow('Connection failed');
    });
  });

  describe('uploadFile', () => {
    it('should upload file to MinIO', async () => {
      const buffer = Buffer.from('test content');
      mockMinioClient.putObject.mockResolvedValue(undefined);

      await service.uploadFile('test/file.pdf', buffer, 'application/pdf');

      expect(mockMinioClient.putObject).toHaveBeenCalledWith(
        'test-bucket',
        'test/file.pdf',
        buffer,
        buffer.length,
        { 'Content-Type': 'application/pdf' },
      );
    });
  });

  describe('deleteFile', () => {
    it('should delete file from MinIO', async () => {
      mockMinioClient.removeObject.mockResolvedValue(undefined);

      await service.deleteFile('test/file.pdf');

      expect(mockMinioClient.removeObject).toHaveBeenCalledWith(
        'test-bucket',
        'test/file.pdf',
      );
    });
  });

  describe('getFileUrl', () => {
    it('should return correct URL for object', () => {
      const url = service.getFileUrl('tenant-id/file.pdf');

      expect(url).toBe('http://localhost:9000/test-bucket/tenant-id/file.pdf');
    });
  });

  describe('getBucketName', () => {
    it('should return bucket name', () => {
      expect(service.getBucketName()).toBe('test-bucket');
    });
  });
});
