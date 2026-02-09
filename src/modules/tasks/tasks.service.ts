import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ReferenceService } from '../reference/reference.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { AddVehiclesDto } from './dto/add-vehicles.dto';
import {
  CompleteVehicleDto,
  CancelVehicleDto,
  RescheduleVehicleDto,
  WorkshopModeDto,
  CancellationReasonModeDto,
} from './dto/status-transitions.dto';
import { CorrectionDto } from './dto/correction.dto';
import { VehicleMaintenanceQueryDto } from './dto/query.dto';
import {
  decodeCursor,
  buildPaginatedResult,
  PaginatedResult,
} from '../../common/dto/pagination.dto';
import {
  MaintenanceType,
  TriggerMode,
  TaskVehicleStatus,
  JobStatus,
  MaintenanceTask,
  MaintenanceTaskVehicle,
  Prisma,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

export interface VehicleWithOverdue extends MaintenanceTaskVehicle {
  overdue: boolean | null;
  overdueComputation: 'computed' | 'insufficient_data' | 'not_applicable';
  vehicleJobs: Array<{
    jobCode: string;
    status: JobStatus;
    updatedAt: Date;
  }>;
}

export interface TaskWithDetails extends MaintenanceTask {
  vehicles: VehicleWithOverdue[];
  jobs: Array<{
    jobCode: string;
    label: string;
    sortOrder: number;
  }>;
}

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly referenceService: ReferenceService,
  ) {}

  async createTask(
    tenantId: string,
    dto: CreateTaskDto,
    actor: string,
  ): Promise<MaintenanceTask> {
    const task = await this.prisma.$transaction(async (tx) => {
      const createdTask = await tx.maintenanceTask.create({
        data: {
          tenantId,
          title: dto.title,
          maintenanceType: dto.maintenanceType as MaintenanceType,
          triggerMode: dto.triggerMode as TriggerMode | undefined,
          triggerKm: dto.triggerKm,
          triggerDate: dto.triggerDate ? new Date(dto.triggerDate) : undefined,
          remindBeforeKm: dto.remindBeforeKm,
          remindBeforeDays: dto.remindBeforeDays,
          notes: dto.notes,
          createdBy: actor,
          sourceGroupId: dto.sourceGroupId,
          selectionContext: dto.selectionContext as
            | Prisma.InputJsonValue
            | undefined,
        },
      });

      if (dto.checklist && dto.checklist.length > 0) {
        await tx.maintenanceTaskJob.createMany({
          data: dto.checklist.map((item) => ({
            tenantId,
            taskId: createdTask.id,
            jobCode: item.jobCode,
            label: item.label,
            sortOrder: item.sortOrder,
          })),
        });
      }

      if (dto.vehicles && dto.vehicles.length > 0) {
        await tx.maintenanceTaskVehicle.createMany({
          data: dto.vehicles.map((v) => ({
            tenantId,
            taskId: createdTask.id,
            vehicleId: v.vehicleId,
            status: 'open' as TaskVehicleStatus,
            dueOdometerKm: v.dueOdometerKm,
            dueDate: v.dueDate ? new Date(v.dueDate) : undefined,
          })),
        });

        if (dto.checklist && dto.checklist.length > 0) {
          const vehicleJobs = dto.vehicles.flatMap((v) =>
            dto.checklist!.map((job) => ({
              tenantId,
              taskId: createdTask.id,
              vehicleId: v.vehicleId,
              jobCode: job.jobCode,
              status: 'pending' as JobStatus,
            })),
          );

          await tx.maintenanceTaskVehicleJob.createMany({
            data: vehicleJobs,
          });
        }
      }

      return createdTask;
    });

    await this.auditService.log({
      tenantId,
      entityType: 'task',
      entityId: task.id,
      action: 'created',
      actor,
      newValue: { ...dto, id: task.id },
    });

    if (dto.vehicles && dto.vehicles.length > 0) {
      await this.auditService.logMany(
        dto.vehicles.map((v) => ({
          tenantId,
          entityType: 'task_vehicle' as const,
          entityId: task.id,
          action: 'vehicle_added',
          actor,
          newValue: { vehicleId: v.vehicleId, taskId: task.id },
        })),
      );
    }

    return task;
  }

  async addVehicles(
    tenantId: string,
    taskId: string,
    dto: AddVehiclesDto,
    actor: string,
  ): Promise<void> {
    const task = await this.getTaskByIdInternal(tenantId, taskId);

    const existingVehicles = await this.prisma.maintenanceTaskVehicle.findMany({
      where: {
        tenantId,
        taskId,
        vehicleId: { in: dto.vehicles.map((v) => v.vehicleId) },
      },
      select: { vehicleId: true },
    });

    const existingVehicleIds = new Set(
      existingVehicles.map((v) => v.vehicleId),
    );
    const newVehicles = dto.vehicles.filter(
      (v) => !existingVehicleIds.has(v.vehicleId),
    );

    if (newVehicles.length === 0) {
      throw new ConflictException(
        'All vehicles are already assigned to this task',
      );
    }

    const taskJobs = await this.prisma.maintenanceTaskJob.findMany({
      where: { tenantId, taskId },
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.maintenanceTaskVehicle.createMany({
        data: newVehicles.map((v) => ({
          tenantId,
          taskId,
          vehicleId: v.vehicleId,
          status: 'open' as TaskVehicleStatus,
          dueOdometerKm: v.dueOdometerKm,
          dueDate: v.dueDate ? new Date(v.dueDate) : undefined,
        })),
      });

      if (taskJobs.length > 0) {
        const vehicleJobs = newVehicles.flatMap((v) =>
          taskJobs.map((job) => ({
            tenantId,
            taskId,
            vehicleId: v.vehicleId,
            jobCode: job.jobCode,
            status: 'pending' as JobStatus,
          })),
        );

        await tx.maintenanceTaskVehicleJob.createMany({
          data: vehicleJobs,
        });
      }
    });

    await this.auditService.logMany(
      newVehicles.map((v) => ({
        tenantId,
        entityType: 'task_vehicle' as const,
        entityId: task.id,
        action: 'vehicle_added',
        actor,
        newValue: { vehicleId: v.vehicleId, taskId },
      })),
    );
  }

  async getTaskById(
    tenantId: string,
    taskId: string,
  ): Promise<TaskWithDetails> {
    const task = await this.prisma.maintenanceTask.findFirst({
      where: { id: taskId, tenantId },
      include: {
        vehicles: {
          include: {
            vehicleJobs: true,
            workshop: true,
            cancellationReason: true,
          },
        },
        jobs: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!task) {
      throw new NotFoundException(`Task with id ${taskId} not found`);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const vehiclesWithOverdue: VehicleWithOverdue[] = task.vehicles.map((v) => {
      let overdue: boolean | null = null;
      let overdueComputation:
        | 'computed'
        | 'insufficient_data'
        | 'not_applicable' = 'not_applicable';

      if (v.status === 'open' && task.maintenanceType === 'preventive') {
        if (v.dueDate) {
          const dueDate = new Date(v.dueDate);
          dueDate.setHours(0, 0, 0, 0);
          overdue = dueDate < today;
          overdueComputation = 'computed';
        } else if (v.dueOdometerKm !== null) {
          overdue = null;
          overdueComputation = 'insufficient_data';
        }
      }

      return {
        ...v,
        overdue,
        overdueComputation,
        vehicleJobs: v.vehicleJobs.map((vj) => ({
          jobCode: vj.jobCode,
          status: vj.status,
          updatedAt: vj.updatedAt,
        })),
      };
    });

    return {
      ...task,
      vehicles: vehiclesWithOverdue,
      jobs: task.jobs.map((j) => ({
        jobCode: j.jobCode,
        label: j.label,
        sortOrder: j.sortOrder,
      })),
    };
  }

  async getVehicleMaintenance(
    tenantId: string,
    vehicleId: number,
    query: VehicleMaintenanceQueryDto,
  ): Promise<PaginatedResult<Record<string, unknown>>> {
    const limit = query.limit ?? 20;
    const cursorData = query.cursor ? decodeCursor(query.cursor) : null;

    const where: {
      tenantId: string;
      vehicleId: number;
      status?: TaskVehicleStatus;
      task?: { maintenanceType: MaintenanceType };
    } = {
      tenantId,
      vehicleId,
    };

    if (query.status) {
      where.status = query.status as TaskVehicleStatus;
    }

    if (query.maintenanceType) {
      where.task = {
        maintenanceType: query.maintenanceType as MaintenanceType,
      };
    }

    const vehicleTasks = await this.prisma.maintenanceTaskVehicle.findMany({
      where,
      include: {
        task: true,
        vehicleJobs: true,
        workshop: true,
        cancellationReason: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursorData && {
        skip: 1,
        cursor: {
          tenantId_taskId_vehicleId: {
            tenantId,
            taskId: cursorData.id,
            vehicleId,
          },
        },
      }),
    }) as (MaintenanceTaskVehicle & { task: MaintenanceTask; vehicleJobs: any[]; workshop: any; cancellationReason: any })[];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const mappedResults = vehicleTasks.map((vt) => {
      let overdue: boolean | null = null;
      let overdueComputation:
        | 'computed'
        | 'insufficient_data'
        | 'not_applicable' = 'not_applicable';

      if (vt.status === 'open' && vt.task.maintenanceType === 'preventive') {
        if (vt.dueDate) {
          const dueDate = new Date(vt.dueDate);
          dueDate.setHours(0, 0, 0, 0);
          overdue = dueDate < today;
          overdueComputation = 'computed';
        } else if (vt.dueOdometerKm !== null) {
          overdue = null;
          overdueComputation = 'insufficient_data';
        }
      }

      return {
        id: vt.taskId,
        ...vt,
        overdue,
        overdueComputation,
      };
    });

    return buildPaginatedResult(mappedResults, limit);
  }

  async completeVehicle(
    tenantId: string,
    taskId: string,
    vehicleId: number,
    dto: CompleteVehicleDto,
    actor: string,
  ): Promise<void> {
    const taskVehicle = await this.getTaskVehicle(tenantId, taskId, vehicleId);

    if (taskVehicle.status !== 'open') {
      throw new BadRequestException(
        `Cannot complete vehicle. Current status is ${taskVehicle.status}. Use corrections endpoint to modify.`,
      );
    }

    let workshopId: string | null = null;
    let workshopCustom: string | null = null;

    if (dto.workshop.mode === WorkshopModeDto.master) {
      if (!dto.workshop.workshopId) {
        throw new BadRequestException(
          'workshopId is required when mode is master',
        );
      }
      await this.referenceService.getWorkshopById(
        dto.workshop.workshopId,
        tenantId,
      );
      workshopId = dto.workshop.workshopId;
    } else {
      if (!dto.workshop.customName) {
        throw new BadRequestException(
          'customName is required when mode is custom',
        );
      }
      workshopCustom = dto.workshop.customName;
    }

    const previousValue = { ...taskVehicle };

    await this.prisma.$transaction(async (tx) => {
      await tx.maintenanceTaskVehicle.update({
        where: {
          tenantId_taskId_vehicleId: { tenantId, taskId, vehicleId },
        },
        data: {
          status: 'completed',
          completionDate: new Date(dto.completionDate),
          actualOdometerKm: dto.actualOdometerKm,
          workshopId,
          workshopCustom,
          costAmount: new Decimal(dto.cost.amount),
          costCurrency: dto.cost.currency || 'EGP',
        },
      });

      if (dto.jobs && dto.jobs.length > 0) {
        for (const job of dto.jobs) {
          await tx.maintenanceTaskVehicleJob.updateMany({
            where: { tenantId, taskId, vehicleId, jobCode: job.jobCode },
            data: { status: job.status as JobStatus },
          });
        }
      }
    });

    await this.auditService.log({
      tenantId,
      entityType: 'task_vehicle',
      entityId: taskId,
      action: 'status_completed',
      actor,
      previousValue: previousValue as unknown as Record<string, unknown>,
      newValue: { vehicleId, status: 'completed', ...dto },
    });
  }

  async cancelVehicle(
    tenantId: string,
    taskId: string,
    vehicleId: number,
    dto: CancelVehicleDto,
    actor: string,
  ): Promise<void> {
    const taskVehicle = await this.getTaskVehicle(tenantId, taskId, vehicleId);

    if (taskVehicle.status !== 'open') {
      throw new BadRequestException(
        `Cannot cancel vehicle. Current status is ${taskVehicle.status}. Use corrections endpoint to modify.`,
      );
    }

    let cancellationReasonId: string | null = null;
    let cancellationReasonCustom: string | null = null;

    if (dto.cancellationReason.mode === CancellationReasonModeDto.master) {
      if (!dto.cancellationReason.reasonId) {
        throw new BadRequestException(
          'reasonId is required when mode is master',
        );
      }
      await this.referenceService.getReasonById(
        dto.cancellationReason.reasonId,
        tenantId,
      );
      cancellationReasonId = dto.cancellationReason.reasonId;
    } else {
      if (!dto.cancellationReason.customReason) {
        throw new BadRequestException(
          'customReason is required when mode is custom',
        );
      }
      cancellationReasonCustom = dto.cancellationReason.customReason;
    }

    const previousValue = { ...taskVehicle };

    await this.prisma.maintenanceTaskVehicle.update({
      where: {
        tenantId_taskId_vehicleId: { tenantId, taskId, vehicleId },
      },
      data: {
        status: 'cancelled',
        cancellationDate: new Date(dto.date),
        actualOdometerKm: dto.actualOdometerKm,
        cancellationReasonId,
        cancellationReasonCustom,
      },
    });

    await this.auditService.log({
      tenantId,
      entityType: 'task_vehicle',
      entityId: taskId,
      action: 'status_cancelled',
      actor,
      previousValue: previousValue as unknown as Record<string, unknown>,
      newValue: { vehicleId, status: 'cancelled', ...dto },
    });
  }

  async rescheduleVehicle(
    tenantId: string,
    taskId: string,
    vehicleId: number,
    dto: RescheduleVehicleDto,
    actor: string,
  ): Promise<void> {
    const taskVehicle = await this.getTaskVehicle(tenantId, taskId, vehicleId);

    if (taskVehicle.status !== 'open') {
      throw new BadRequestException(
        `Cannot reschedule vehicle. Current status is ${taskVehicle.status}. Use corrections endpoint to modify.`,
      );
    }

    const previousValue = { ...taskVehicle };

    await this.prisma.maintenanceTaskVehicle.update({
      where: {
        tenantId_taskId_vehicleId: { tenantId, taskId, vehicleId },
      },
      data: {
        status: 'rescheduled',
        rescheduleOriginalDueDate: new Date(dto.originalDate),
        rescheduleNewDueDate: new Date(dto.newScheduledDate),
        rescheduleOdometerKm: dto.rescheduleOdometerKm,
        rescheduleReason: dto.reason,
      },
    });

    await this.auditService.log({
      tenantId,
      entityType: 'task_vehicle',
      entityId: taskId,
      action: 'status_rescheduled',
      actor,
      previousValue: previousValue as unknown as Record<string, unknown>,
      newValue: { vehicleId, status: 'rescheduled', ...dto },
    });
  }

  async applyCorrection(
    tenantId: string,
    taskId: string,
    vehicleId: number,
    dto: CorrectionDto,
    actor: string,
  ): Promise<void> {
    const taskVehicle = await this.getTaskVehicle(tenantId, taskId, vehicleId);

    if (taskVehicle.status === 'open') {
      throw new BadRequestException(
        'Corrections are only allowed for completed, cancelled, or rescheduled records',
      );
    }

    const previousValue = { ...taskVehicle };

    const updateData: Record<string, unknown> = {};
    const allowedFields = [
      'dueOdometerKm',
      'dueDate',
      'actualOdometerKm',
      'completionDate',
      'workshopId',
      'workshopCustom',
      'costAmount',
      'costCurrency',
      'cancellationDate',
      'cancellationReasonId',
      'cancellationReasonCustom',
      'rescheduleOriginalDueDate',
      'rescheduleNewDueDate',
      'rescheduleReason',
      'rescheduleOdometerKm',
    ];

    for (const [key, value] of Object.entries(dto.patch)) {
      if (allowedFields.includes(key) && value !== undefined) {
        if (key.includes('Date') && value) {
          updateData[key] = new Date(value as string);
        } else if (key === 'costAmount' && value !== undefined) {
          updateData[key] = new Decimal(value as number);
        } else {
          updateData[key] = value;
        }
      }
    }

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException('No valid fields to update');
    }

    await this.prisma.maintenanceTaskVehicle.update({
      where: {
        tenantId_taskId_vehicleId: { tenantId, taskId, vehicleId },
      },
      data: updateData,
    });

    await this.auditService.log({
      tenantId,
      entityType: 'task_vehicle',
      entityId: taskId,
      action: 'correction_applied',
      actor,
      previousValue: previousValue as unknown as Record<string, unknown>,
      newValue: {
        vehicleId,
        correctionReason: dto.correctionReason,
        changes: dto.patch,
      },
    });
  }

  private async getTaskByIdInternal(
    tenantId: string,
    taskId: string,
  ): Promise<MaintenanceTask> {
    const task = await this.prisma.maintenanceTask.findFirst({
      where: { id: taskId, tenantId },
    });

    if (!task) {
      throw new NotFoundException(`Task with id ${taskId} not found`);
    }

    return task;
  }

  private async getTaskVehicle(
    tenantId: string,
    taskId: string,
    vehicleId: number,
  ): Promise<MaintenanceTaskVehicle> {
    await this.getTaskByIdInternal(tenantId, taskId);

    const taskVehicle = await this.prisma.maintenanceTaskVehicle.findFirst({
      where: { tenantId, taskId, vehicleId },
    });

    if (!taskVehicle) {
      throw new NotFoundException(
        `Vehicle ${vehicleId} not found in task ${taskId}`,
      );
    }

    return taskVehicle;
  }
}
