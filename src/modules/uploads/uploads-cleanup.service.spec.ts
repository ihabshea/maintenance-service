import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UploadsCleanupService } from './uploads-cleanup.service';
import { UploadsService } from './uploads.service';

describe('UploadsCleanupService', () => {
  let service: UploadsCleanupService;

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue: any) => {
      if (key === 'UPLOAD_RETENTION_HOURS') return 24;
      return defaultValue;
    }),
  };

  const mockUploadsService = {
    findUnclaimedOlderThan: jest.fn(),
    deleteUpload: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploadsCleanupService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: UploadsService, useValue: mockUploadsService },
      ],
    }).compile();

    service = module.get<UploadsCleanupService>(UploadsCleanupService);
  });

  describe('cleanupOrphanedUploads', () => {
    it('should delete orphaned uploads', async () => {
      const mockOrphans = [
        { id: '1', objectKey: 'test/file1.pdf', tenantId: '1' },
        { id: '2', objectKey: 'test/file2.pdf', tenantId: '2' },
      ];

      mockUploadsService.findUnclaimedOlderThan.mockResolvedValue(mockOrphans);
      mockUploadsService.deleteUpload.mockResolvedValue(undefined);

      await service.cleanupOrphanedUploads();

      expect(mockUploadsService.findUnclaimedOlderThan).toHaveBeenCalledWith(
        24,
      );
      expect(mockUploadsService.deleteUpload).toHaveBeenCalledTimes(2);
      expect(mockUploadsService.deleteUpload).toHaveBeenCalledWith(
        mockOrphans[0],
      );
      expect(mockUploadsService.deleteUpload).toHaveBeenCalledWith(
        mockOrphans[1],
      );
    });

    it('should continue if individual delete fails', async () => {
      const mockOrphans = [
        { id: '1', objectKey: 'test/file1.pdf', tenantId: '1' },
        { id: '2', objectKey: 'test/file2.pdf', tenantId: '2' },
        { id: '3', objectKey: 'test/file3.pdf', tenantId: '3' },
      ];

      mockUploadsService.findUnclaimedOlderThan.mockResolvedValue(mockOrphans);
      mockUploadsService.deleteUpload
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Delete failed'))
        .mockResolvedValueOnce(undefined);

      await service.cleanupOrphanedUploads();

      expect(mockUploadsService.deleteUpload).toHaveBeenCalledTimes(3);
    });

    it('should handle empty orphan list', async () => {
      mockUploadsService.findUnclaimedOlderThan.mockResolvedValue([]);

      await service.cleanupOrphanedUploads();

      expect(mockUploadsService.findUnclaimedOlderThan).toHaveBeenCalledWith(
        24,
      );
      expect(mockUploadsService.deleteUpload).not.toHaveBeenCalled();
    });

    it('should handle query failure gracefully', async () => {
      mockUploadsService.findUnclaimedOlderThan.mockRejectedValue(
        new Error('DB connection failed'),
      );

      await expect(service.cleanupOrphanedUploads()).resolves.not.toThrow();
      expect(mockUploadsService.deleteUpload).not.toHaveBeenCalled();
    });
  });
});
