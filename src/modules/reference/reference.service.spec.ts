import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
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
      update: jest.fn(),
    },
    reason: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
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

  describe('updateWorkshop', () => {
    const mockTenantWorkshop = {
      id: 'ws-1',
      scope: 'tenant',
      tenantId: mockTenantId,
      name: 'Old Name',
      location: 'Old Location',
      status: 'active',
    };

    const mockSystemWorkshop = {
      id: 'ws-sys',
      scope: 'system',
      tenantId: null,
      name: 'System Workshop',
      location: null,
      status: 'active',
    };

    it('should update a tenant workshop', async () => {
      const updateDto = { name: 'New Name', location: 'New Location' };
      const updatedWorkshop = { ...mockTenantWorkshop, ...updateDto };

      mockPrismaService.workshop.findFirst.mockResolvedValue(
        mockTenantWorkshop,
      );
      mockPrismaService.workshop.update.mockResolvedValue(updatedWorkshop);

      const result = await service.updateWorkshop(
        'ws-1',
        mockTenantId,
        updateDto,
        mockActor,
      );

      expect(mockPrismaService.workshop.update).toHaveBeenCalledWith({
        where: { id: 'ws-1' },
        data: updateDto,
      });
      expect(result).toEqual(updatedWorkshop);
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'updated',
          entityType: 'workshop',
          entityId: 'ws-1',
        }),
      );
    });

    it('should throw NotFoundException if workshop not found', async () => {
      mockPrismaService.workshop.findFirst.mockResolvedValue(null);

      await expect(
        service.updateWorkshop(
          'nonexistent',
          mockTenantId,
          { name: 'X' },
          mockActor,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException for system workshop', async () => {
      mockPrismaService.workshop.findFirst.mockResolvedValue(
        mockSystemWorkshop,
      );

      await expect(
        service.updateWorkshop(
          'ws-sys',
          mockTenantId,
          { name: 'X' },
          mockActor,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('deleteWorkshop', () => {
    const mockTenantWorkshop = {
      id: 'ws-1',
      scope: 'tenant',
      tenantId: mockTenantId,
      name: 'Workshop',
      location: null,
      status: 'active',
    };

    const mockSystemWorkshop = {
      id: 'ws-sys',
      scope: 'system',
      tenantId: null,
      name: 'System Workshop',
      location: null,
      status: 'active',
    };

    it('should soft-delete a tenant workshop by setting status to inactive', async () => {
      const deletedWorkshop = { ...mockTenantWorkshop, status: 'inactive' };

      mockPrismaService.workshop.findFirst.mockResolvedValue(
        mockTenantWorkshop,
      );
      mockPrismaService.workshop.update.mockResolvedValue(deletedWorkshop);

      const result = await service.deleteWorkshop(
        'ws-1',
        mockTenantId,
        mockActor,
      );

      expect(mockPrismaService.workshop.update).toHaveBeenCalledWith({
        where: { id: 'ws-1' },
        data: { status: 'inactive' },
      });
      expect(result.status).toBe('inactive');
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'deleted',
          entityType: 'workshop',
          entityId: 'ws-1',
        }),
      );
    });

    it('should throw NotFoundException if workshop not found', async () => {
      mockPrismaService.workshop.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteWorkshop('nonexistent', mockTenantId, mockActor),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException for system workshop', async () => {
      mockPrismaService.workshop.findFirst.mockResolvedValue(
        mockSystemWorkshop,
      );

      await expect(
        service.deleteWorkshop('ws-sys', mockTenantId, mockActor),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updateReason', () => {
    const mockTenantReason = {
      id: 'r-1',
      scope: 'tenant',
      tenantId: mockTenantId,
      reasonType: 'cancellation',
      label: 'Old Label',
      status: 'active',
    };

    const mockSystemReason = {
      id: 'r-sys',
      scope: 'system',
      tenantId: null,
      reasonType: 'cancellation',
      label: 'System Reason',
      status: 'active',
    };

    it('should update a tenant reason', async () => {
      const updateDto = { label: 'New Label' };
      const updatedReason = { ...mockTenantReason, ...updateDto };

      mockPrismaService.reason.findFirst.mockResolvedValue(mockTenantReason);
      mockPrismaService.reason.update.mockResolvedValue(updatedReason);

      const result = await service.updateReason(
        'r-1',
        mockTenantId,
        updateDto,
        mockActor,
      );

      expect(mockPrismaService.reason.update).toHaveBeenCalledWith({
        where: { id: 'r-1' },
        data: updateDto,
      });
      expect(result).toEqual(updatedReason);
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'updated',
          entityType: 'reason',
          entityId: 'r-1',
        }),
      );
    });

    it('should throw NotFoundException if reason not found', async () => {
      mockPrismaService.reason.findFirst.mockResolvedValue(null);

      await expect(
        service.updateReason(
          'nonexistent',
          mockTenantId,
          { label: 'X' },
          mockActor,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException for system reason', async () => {
      mockPrismaService.reason.findFirst.mockResolvedValue(mockSystemReason);

      await expect(
        service.updateReason('r-sys', mockTenantId, { label: 'X' }, mockActor),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('deleteReason', () => {
    const mockTenantReason = {
      id: 'r-1',
      scope: 'tenant',
      tenantId: mockTenantId,
      reasonType: 'cancellation',
      label: 'Reason',
      status: 'active',
    };

    const mockSystemReason = {
      id: 'r-sys',
      scope: 'system',
      tenantId: null,
      reasonType: 'cancellation',
      label: 'System Reason',
      status: 'active',
    };

    it('should soft-delete a tenant reason by setting status to inactive', async () => {
      const deletedReason = { ...mockTenantReason, status: 'inactive' };

      mockPrismaService.reason.findFirst.mockResolvedValue(mockTenantReason);
      mockPrismaService.reason.update.mockResolvedValue(deletedReason);

      const result = await service.deleteReason('r-1', mockTenantId, mockActor);

      expect(mockPrismaService.reason.update).toHaveBeenCalledWith({
        where: { id: 'r-1' },
        data: { status: 'inactive' },
      });
      expect(result.status).toBe('inactive');
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'deleted',
          entityType: 'reason',
          entityId: 'r-1',
        }),
      );
    });

    it('should throw NotFoundException if reason not found', async () => {
      mockPrismaService.reason.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteReason('nonexistent', mockTenantId, mockActor),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException for system reason', async () => {
      mockPrismaService.reason.findFirst.mockResolvedValue(mockSystemReason);

      await expect(
        service.deleteReason('r-sys', mockTenantId, mockActor),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
