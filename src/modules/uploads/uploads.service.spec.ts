import { Test, TestingModule } from '@nestjs/testing';
import { UploadsService } from './uploads.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { MinioService } from './minio.service';

describe('UploadsService', () => {
  let service: UploadsService;

  const mockTenantId = '00000000-0000-0000-0000-000000000001';
  const mockUploadId = '00000000-0000-0000-0000-000000000002';
  const mockActor = 'test-user';

  const mockFile: Express.Multer.File = {
    fieldname: 'file',
    originalname: 'test-file.pdf',
    encoding: '7bit',
    mimetype: 'application/pdf',
    size: 1024,
    buffer: Buffer.from('test content'),
    stream: null as any,
    destination: '',
    filename: '',
    path: '',
  };

  const mockPrismaService = {
    upload: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockAuditService = {
    log: jest.fn(),
  };

  const mockMinioService = {
    uploadFile: jest.fn(),
    deleteFile: jest.fn(),
    getFileUrl: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploadsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditService, useValue: mockAuditService },
        { provide: MinioService, useValue: mockMinioService },
      ],
    }).compile();

    service = module.get<UploadsService>(UploadsService);

    jest.clearAllMocks();
  });

  describe('uploadFile', () => {
    it('should upload file to MinIO and create DB record', async () => {
      const mockUpload = {
        id: mockUploadId,
        tenantId: mockTenantId,
        objectKey: `${mockTenantId}/${mockUploadId}-test-file.pdf`,
        fileUrl: `http://localhost:9000/maintenance-uploads/${mockTenantId}/${mockUploadId}-test-file.pdf`,
        fileName: 'test-file.pdf',
        contentType: 'application/pdf',
        fileSize: BigInt(1024),
        uploadedBy: mockActor,
        createdAt: new Date(),
        claimedAt: null,
      };

      mockMinioService.getFileUrl.mockReturnValue(mockUpload.fileUrl);
      mockPrismaService.upload.create.mockResolvedValue(mockUpload);

      const result = await service.uploadFile(
        mockTenantId,
        mockFile,
        mockActor,
      );

      expect(mockMinioService.uploadFile).toHaveBeenCalledWith(
        expect.stringContaining(mockTenantId),
        mockFile.buffer,
        mockFile.mimetype,
      );
      expect(mockPrismaService.upload.create).toHaveBeenCalled();
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: mockTenantId,
          entityType: 'upload',
          action: 'created',
        }),
      );
      expect(result.id).toBe(mockUploadId);
    });

    it('should sanitize filename in object key', async () => {
      const fileWithSpecialChars: Express.Multer.File = {
        ...mockFile,
        originalname: 'test file (1).pdf',
      };

      const mockUpload = {
        id: mockUploadId,
        tenantId: mockTenantId,
        objectKey: expect.any(String),
        fileUrl: 'http://localhost:9000/test',
        fileName: 'test file (1).pdf',
        contentType: 'application/pdf',
        fileSize: BigInt(1024),
        uploadedBy: mockActor,
        createdAt: new Date(),
        claimedAt: null,
      };

      mockMinioService.getFileUrl.mockReturnValue(mockUpload.fileUrl);
      mockPrismaService.upload.create.mockResolvedValue(mockUpload);

      await service.uploadFile(mockTenantId, fileWithSpecialChars, mockActor);

      expect(mockMinioService.uploadFile).toHaveBeenCalledWith(
        expect.stringContaining('test_file__1_.pdf'),
        expect.any(Buffer),
        expect.any(String),
      );
    });
  });

  describe('claimUpload', () => {
    it('should mark upload as claimed', async () => {
      const mockUpload = {
        id: mockUploadId,
        tenantId: mockTenantId,
        fileUrl: 'http://localhost:9000/test/file.pdf',
        claimedAt: null,
      };

      mockPrismaService.upload.findFirst.mockResolvedValue(mockUpload);
      mockPrismaService.upload.update.mockResolvedValue({
        ...mockUpload,
        claimedAt: new Date(),
      });

      await service.claimUpload(mockTenantId, mockUpload.fileUrl);

      expect(mockPrismaService.upload.findFirst).toHaveBeenCalledWith({
        where: { tenantId: mockTenantId, fileUrl: mockUpload.fileUrl },
      });
      expect(mockPrismaService.upload.update).toHaveBeenCalledWith({
        where: { id: mockUploadId },
        data: { claimedAt: expect.any(Date) },
      });
    });

    it('should not update if upload not found', async () => {
      mockPrismaService.upload.findFirst.mockResolvedValue(null);

      await service.claimUpload(mockTenantId, 'http://nonexistent.url');

      expect(mockPrismaService.upload.update).not.toHaveBeenCalled();
    });

    it('should not update if already claimed', async () => {
      const mockUpload = {
        id: mockUploadId,
        claimedAt: new Date(),
      };

      mockPrismaService.upload.findFirst.mockResolvedValue(mockUpload);

      await service.claimUpload(mockTenantId, 'http://test.url');

      expect(mockPrismaService.upload.update).not.toHaveBeenCalled();
    });
  });

  describe('findUnclaimedOlderThan', () => {
    it('should query uploads older than specified hours', async () => {
      const mockUploads = [
        { id: '1', claimedAt: null, createdAt: new Date('2024-01-01') },
        { id: '2', claimedAt: null, createdAt: new Date('2024-01-02') },
      ];

      mockPrismaService.upload.findMany.mockResolvedValue(mockUploads);

      const result = await service.findUnclaimedOlderThan(24);

      expect(mockPrismaService.upload.findMany).toHaveBeenCalledWith({
        where: {
          claimedAt: null,
          createdAt: { lt: expect.any(Date) },
        },
      });
      expect(result).toEqual(mockUploads);
    });
  });

  describe('deleteUpload', () => {
    it('should delete from MinIO and DB, and create audit log', async () => {
      const mockUpload = {
        id: mockUploadId,
        tenantId: mockTenantId,
        objectKey: 'test/file.pdf',
        fileName: 'file.pdf',
      };

      await service.deleteUpload(mockUpload as any);

      expect(mockMinioService.deleteFile).toHaveBeenCalledWith(
        mockUpload.objectKey,
      );
      expect(mockPrismaService.upload.delete).toHaveBeenCalledWith({
        where: { id: mockUploadId },
      });
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: mockTenantId,
          entityType: 'upload',
          action: 'deleted',
          actor: 'system',
        }),
      );
    });
  });
});
