import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ReferenceService } from './reference.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ReasonTypeDto } from './dto/create-reason.dto';

describe('ReferenceService', () => {
  let service: ReferenceService;

  const mockTenantId = '1';
  const mockActor = 'test-user';

  const mockPrismaService = {
    workshop: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    reason: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  };

  const mockAuditService = {
    log: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReferenceService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<ReferenceService>(ReferenceService);

    jest.clearAllMocks();
  });

  describe('getWorkshops', () => {
    it('should return system and tenant workshops with pagination', async () => {
      const mockWorkshops = [
        { id: '1', scope: 'system', tenantId: null, name: 'System Workshop' },
        {
          id: '2',
          scope: 'tenant',
          tenantId: mockTenantId,
          name: 'Tenant Workshop',
        },
      ];

      mockPrismaService.workshop.findMany.mockResolvedValue(mockWorkshops);

      const result = await service.getWorkshops(mockTenantId, { limit: 20 });

      expect(mockPrismaService.workshop.findMany).toHaveBeenCalledWith({
        where: {
          OR: [{ tenantId: null }, { tenantId: mockTenantId }],
          status: 'active',
        },
        orderBy: [{ scope: 'asc' }, { name: 'asc' }],
        take: 21,
      });
      expect(result.data).toEqual(mockWorkshops);
      expect(result.pagination.hasMore).toBe(false);
    });
  });

  describe('getWorkshopById', () => {
    it('should return workshop if found', async () => {
      const mockWorkshop = {
        id: '1',
        scope: 'system',
        tenantId: null,
        name: 'Test Workshop',
      };

      mockPrismaService.workshop.findFirst.mockResolvedValue(mockWorkshop);

      const result = await service.getWorkshopById('1', mockTenantId);

      expect(result).toEqual(mockWorkshop);
    });

    it('should throw NotFoundException if workshop not found', async () => {
      mockPrismaService.workshop.findFirst.mockResolvedValue(null);

      await expect(
        service.getWorkshopById('nonexistent', mockTenantId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('createWorkshop', () => {
    it('should create a tenant workshop', async () => {
      const createDto = { name: 'New Workshop', location: 'Cairo' };
      const mockWorkshop = {
        id: '1',
        scope: 'tenant',
        tenantId: mockTenantId,
        ...createDto,
        status: 'active',
      };

      mockPrismaService.workshop.create.mockResolvedValue(mockWorkshop);

      const result = await service.createWorkshop(
        mockTenantId,
        createDto,
        mockActor,
        false,
      );

      expect(mockPrismaService.workshop.create).toHaveBeenCalledWith({
        data: {
          scope: 'tenant',
          tenantId: mockTenantId,
          name: createDto.name,
          location: createDto.location,
          status: 'active',
        },
      });
      expect(result).toEqual(mockWorkshop);
    });
  });

  describe('getReasons', () => {
    it('should return filtered reasons by type with pagination', async () => {
      const mockReasons = [
        {
          id: '1',
          scope: 'system',
          reasonType: 'cancellation',
          label: 'Reason 1',
        },
      ];

      mockPrismaService.reason.findMany.mockResolvedValue(mockReasons);

      const result = await service.getReasons(mockTenantId, 'cancellation', {
        limit: 20,
      });

      expect(mockPrismaService.reason.findMany).toHaveBeenCalledWith({
        where: {
          OR: [{ tenantId: null }, { tenantId: mockTenantId }],
          status: 'active',
          reasonType: 'cancellation',
        },
        orderBy: [{ scope: 'asc' }, { label: 'asc' }],
        take: 21,
      });
      expect(result.data).toEqual(mockReasons);
      expect(result.pagination.hasMore).toBe(false);
    });
  });

  describe('createReason', () => {
    it('should create a tenant reason', async () => {
      const createDto = {
        reasonType: ReasonTypeDto.cancellation,
        label: 'Custom Reason',
      };
      const mockReason = {
        id: '1',
        scope: 'tenant',
        tenantId: mockTenantId,
        ...createDto,
        status: 'active',
      };

      mockPrismaService.reason.create.mockResolvedValue(mockReason);

      const result = await service.createReason(
        mockTenantId,
        createDto,
        mockActor,
      );

      expect(mockPrismaService.reason.create).toHaveBeenCalledWith({
        data: {
          scope: 'tenant',
          tenantId: mockTenantId,
          reasonType: 'cancellation',
          label: createDto.label,
          status: 'active',
        },
      });
      expect(result).toEqual(mockReason);
    });
  });
});
