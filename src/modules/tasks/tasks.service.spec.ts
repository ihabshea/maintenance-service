import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ReferenceService } from '../reference/reference.service';
import { MaintenanceTypeDto, TriggerModeDto } from './dto/create-task.dto';
import {
  WorkshopModeDto,
  CancellationReasonModeDto,
} from './dto/status-transitions.dto';

describe('TasksService', () => {
  let service: TasksService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prisma: any;

  const mockTenantId = '00000000-0000-0000-0000-000000000001';
  const mockTaskId = '00000000-0000-0000-0000-000000000002';
  const mockVehicleId = '00000000-0000-0000-0000-000000000003';
  const mockWorkshopId = '00000000-0000-0000-0000-000000000004';
  const mockActor = 'test-user';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const createMockPrisma = (): any => {
    const maintenanceTask = {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    };
    const maintenanceTaskVehicle = {
      create: jest.fn(),
      createMany: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    };
    const maintenanceTaskJob = {
      createMany: jest.fn(),
      findMany: jest.fn(),
    };
    const maintenanceTaskVehicleJob = {
      createMany: jest.fn(),
      updateMany: jest.fn(),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mock: any = {
      maintenanceTask,
      maintenanceTaskVehicle,
      maintenanceTaskJob,
      maintenanceTaskVehicleJob,
      $transaction: null,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mock.$transaction = jest.fn((fn: any) => fn(mock));
    return mock;
  };

  const mockAuditService = {
    log: jest.fn(),
    logMany: jest.fn(),
  };

  const mockReferenceService = {
    getWorkshopById: jest.fn(),
    getReasonById: jest.fn(),
  };

  beforeEach(async () => {
    prisma = createMockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: mockAuditService },
        { provide: ReferenceService, useValue: mockReferenceService },
      ],
    }).compile();

    service = module.get<TasksService>(TasksService);
    jest.clearAllMocks();
  });

  describe('createTask', () => {
    it('should create a task with vehicles and checklist', async () => {
      const createDto = {
        title: 'Oil Change',
        maintenanceType: MaintenanceTypeDto.preventive,
        triggerMode: TriggerModeDto.mileage,
        triggerKm: 5000,
        vehicles: [{ vehicleId: mockVehicleId, dueOdometerKm: 50000 }],
        checklist: [{ jobCode: 'OIL001', label: 'Change oil', sortOrder: 1 }],
      };

      const mockTask = {
        id: mockTaskId,
        tenantId: mockTenantId,
        ...createDto,
        createdBy: mockActor,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.maintenanceTask.create.mockResolvedValue(mockTask);
      prisma.maintenanceTaskJob.createMany.mockResolvedValue({ count: 1 });
      prisma.maintenanceTaskVehicle.createMany.mockResolvedValue({ count: 1 });
      prisma.maintenanceTaskVehicleJob.createMany.mockResolvedValue({
        count: 1,
      });

      const result = await service.createTask(
        mockTenantId,
        createDto,
        mockActor,
      );

      expect(result.id).toBe(mockTaskId);
      expect(prisma.maintenanceTask.create).toHaveBeenCalled();
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: mockTenantId,
          entityType: 'task',
          action: 'created',
        }),
      );
    });
  });

  describe('completeVehicle', () => {
    it('should complete a vehicle with open status', async () => {
      const mockTaskVehicle = {
        tenantId: mockTenantId,
        taskId: mockTaskId,
        vehicleId: mockVehicleId,
        status: 'open',
      };

      prisma.maintenanceTask.findFirst.mockResolvedValue({
        id: mockTaskId,
        tenantId: mockTenantId,
      });
      prisma.maintenanceTaskVehicle.findFirst.mockResolvedValue(
        mockTaskVehicle,
      );
      prisma.maintenanceTaskVehicle.update.mockResolvedValue({
        ...mockTaskVehicle,
        status: 'completed',
      });
      mockReferenceService.getWorkshopById.mockResolvedValue({
        id: mockWorkshopId,
        name: 'Test Workshop',
      });

      const completeDto = {
        completionDate: '2024-01-15',
        actualOdometerKm: 50500,
        workshop: {
          mode: WorkshopModeDto.master,
          workshopId: mockWorkshopId,
        },
        cost: { amount: 100, currency: 'EGP' },
      };

      await service.completeVehicle(
        mockTenantId,
        mockTaskId,
        mockVehicleId,
        completeDto,
        mockActor,
      );

      expect(prisma.maintenanceTaskVehicle.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'completed',
          }),
        }),
      );
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'status_completed',
        }),
      );
    });

    it('should throw error when trying to complete non-open vehicle', async () => {
      const mockTaskVehicle = {
        tenantId: mockTenantId,
        taskId: mockTaskId,
        vehicleId: mockVehicleId,
        status: 'completed',
      };

      prisma.maintenanceTask.findFirst.mockResolvedValue({
        id: mockTaskId,
        tenantId: mockTenantId,
      });
      prisma.maintenanceTaskVehicle.findFirst.mockResolvedValue(
        mockTaskVehicle,
      );

      const completeDto = {
        completionDate: '2024-01-15',
        actualOdometerKm: 50500,
        workshop: { mode: WorkshopModeDto.master, workshopId: mockWorkshopId },
        cost: { amount: 100 },
      };

      await expect(
        service.completeVehicle(
          mockTenantId,
          mockTaskId,
          mockVehicleId,
          completeDto,
          mockActor,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('cancelVehicle', () => {
    it('should cancel a vehicle with open status', async () => {
      const mockTaskVehicle = {
        tenantId: mockTenantId,
        taskId: mockTaskId,
        vehicleId: mockVehicleId,
        status: 'open',
      };

      prisma.maintenanceTask.findFirst.mockResolvedValue({
        id: mockTaskId,
        tenantId: mockTenantId,
      });
      prisma.maintenanceTaskVehicle.findFirst.mockResolvedValue(
        mockTaskVehicle,
      );
      prisma.maintenanceTaskVehicle.update.mockResolvedValue({
        ...mockTaskVehicle,
        status: 'cancelled',
      });

      const cancelDto = {
        date: '2024-01-15',
        actualOdometerKm: 50500,
        cancellationReason: {
          mode: CancellationReasonModeDto.custom,
          customReason: 'Vehicle sold',
        },
      };

      await service.cancelVehicle(
        mockTenantId,
        mockTaskId,
        mockVehicleId,
        cancelDto,
        mockActor,
      );

      expect(prisma.maintenanceTaskVehicle.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'cancelled',
          }),
        }),
      );
    });
  });

  describe('rescheduleVehicle', () => {
    it('should reschedule a vehicle with open status', async () => {
      const mockTaskVehicle = {
        tenantId: mockTenantId,
        taskId: mockTaskId,
        vehicleId: mockVehicleId,
        status: 'open',
      };

      prisma.maintenanceTask.findFirst.mockResolvedValue({
        id: mockTaskId,
        tenantId: mockTenantId,
      });
      prisma.maintenanceTaskVehicle.findFirst.mockResolvedValue(
        mockTaskVehicle,
      );
      prisma.maintenanceTaskVehicle.update.mockResolvedValue({
        ...mockTaskVehicle,
        status: 'rescheduled',
      });

      const rescheduleDto = {
        originalDate: '2024-01-15',
        newScheduledDate: '2024-02-15',
        rescheduleOdometerKm: 50000,
        reason: 'Parts not available',
      };

      await service.rescheduleVehicle(
        mockTenantId,
        mockTaskId,
        mockVehicleId,
        rescheduleDto,
        mockActor,
      );

      expect(prisma.maintenanceTaskVehicle.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'rescheduled',
          }),
        }),
      );
    });
  });

  describe('applyCorrection', () => {
    it('should apply correction to completed vehicle', async () => {
      const mockTaskVehicle = {
        tenantId: mockTenantId,
        taskId: mockTaskId,
        vehicleId: mockVehicleId,
        status: 'completed',
        costAmount: 100,
      };

      prisma.maintenanceTask.findFirst.mockResolvedValue({
        id: mockTaskId,
        tenantId: mockTenantId,
      });
      prisma.maintenanceTaskVehicle.findFirst.mockResolvedValue(
        mockTaskVehicle,
      );
      prisma.maintenanceTaskVehicle.update.mockResolvedValue({
        ...mockTaskVehicle,
        costAmount: 150,
      });

      const correctionDto = {
        correctionReason: 'Cost was incorrect',
        patch: { costAmount: 150 },
      };

      await service.applyCorrection(
        mockTenantId,
        mockTaskId,
        mockVehicleId,
        correctionDto,
        mockActor,
      );

      expect(prisma.maintenanceTaskVehicle.update).toHaveBeenCalled();
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'correction_applied',
        }),
      );
    });

    it('should throw error when trying to correct open vehicle', async () => {
      const mockTaskVehicle = {
        tenantId: mockTenantId,
        taskId: mockTaskId,
        vehicleId: mockVehicleId,
        status: 'open',
      };

      prisma.maintenanceTask.findFirst.mockResolvedValue({
        id: mockTaskId,
        tenantId: mockTenantId,
      });
      prisma.maintenanceTaskVehicle.findFirst.mockResolvedValue(
        mockTaskVehicle,
      );

      const correctionDto = {
        correctionReason: 'Some reason',
        patch: { costAmount: 150 },
      };

      await expect(
        service.applyCorrection(
          mockTenantId,
          mockTaskId,
          mockVehicleId,
          correctionDto,
          mockActor,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('tenancy filtering', () => {
    it('should return 404 when task belongs to different tenant', async () => {
      prisma.maintenanceTask.findFirst.mockResolvedValue(null);

      await expect(
        service.getTaskById(mockTenantId, mockTaskId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should filter vehicle maintenance by tenant', async () => {
      prisma.maintenanceTaskVehicle.findMany.mockResolvedValue([]);

      const result = await service.getVehicleMaintenance(
        mockTenantId,
        mockVehicleId,
        {},
      );

      expect(prisma.maintenanceTaskVehicle.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: mockTenantId,
          }),
        }),
      );
      expect(result).toEqual([]);
    });
  });
});
