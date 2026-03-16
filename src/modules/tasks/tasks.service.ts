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
  RescheduleReasonModeDto,
} from './dto/status-transitions.dto';
import { CorrectionDto } from './dto/correction.dto';
import {
  VehicleMaintenanceQueryDto,
  TaskListQueryDto,
  TaskCompletionFilterDto,
  BulkVehicleMaintenanceDto,
  BulkVehicleMaintenanceQueryDto,
  VehicleActivityFilterDto,
} from './dto/query.dto';
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
  overdue: boolean;
  overdueComputation: 'computed' | 'insufficient_data' | 'not_applicable';
  vehicleJobs: Array<{
    jobCode: string;
    status: JobStatus;
    updatedAt: Date;
  }>;
}

export interface TaskWithDetails extends MaintenanceTask {
  completion: 'completed' | 'incompleted';
  vehicles: VehicleWithOverdue[];
  checklist: Array<{
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
  ) {
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
      action: 'create',
      actor,
      newValue: { ...dto, id: task.id },
    });

    if (dto.vehicles && dto.vehicles.length > 0) {
      await this.auditService.logMany(
        dto.vehicles.map((v) => ({
          tenantId,
          entityType: 'task_vehicle' as const,
          entityId: task.id,
          action: 'create',
          actor,
          newValue: { vehicleId: v.vehicleId, taskId: task.id },
        })),
      );
    }

    return this.getTaskById(tenantId, task.id);
  }

  async addVehicles(
    tenantId: string,
    taskId: string,
    dto: AddVehiclesDto,
    actor: string,
  ) {
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

    // Fail on first duplicate (matches mock behavior)
    for (const v of dto.vehicles) {
      if (existingVehicleIds.has(v.vehicleId)) {
        throw new ConflictException(
          `Vehicle ${v.vehicleId} already exists on this task`,
        );
      }
    }

    const newVehicles = dto.vehicles;

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
        action: 'create',
        actor,
        newValue: { vehicleId: v.vehicleId, taskId },
      })),
    );

    // Return the created vehicles with full details
    const createdVehicles = await this.prisma.maintenanceTaskVehicle.findMany({
      where: {
        tenantId,
        taskId,
        vehicleId: { in: newVehicles.map((v) => v.vehicleId) },
      },
      include: { vehicleJobs: true },
    });

    return createdVehicles.map((v) => this.buildVehicleResponse(task, v));
  }

  async listTasks(
    tenantId: string,
    query: TaskListQueryDto,
  ) {
    const limit = query.limit ?? 20;
    const cursorData = query.cursor ? decodeCursor(query.cursor) : null;

    const where: Prisma.MaintenanceTaskWhereInput = { tenantId };

    if (query.maintenanceType) {
      where.maintenanceType = query.maintenanceType as MaintenanceType;
    }

    if (query.status) {
      where.vehicles = {
        ...where.vehicles as any,
        some: { status: query.status as TaskVehicleStatus },
      };
    }

    if (query.completion === TaskCompletionFilterDto.completed) {
      // All vehicles must be non-open (no open vehicles exist)
      where.vehicles = {
        every: { status: { not: 'open' } },
        some: {}, // must have at least one vehicle
      };
    } else if (query.completion === TaskCompletionFilterDto.incompleted) {
      // At least one vehicle is open
      where.vehicles = { some: { status: 'open' } };
    }

    const tasks = await this.prisma.maintenanceTask.findMany({
      where,
      include: {
        vehicles: {
          include: {
            vehicleJobs: true,
            workshop: true,
            cancellationReason: true,
            rescheduleReason: true,
          },
        },
        jobs: {
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursorData && {
        skip: 1,
        cursor: { id: cursorData.id },
      }),
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const mapped = tasks.map((task) => this.buildTaskResponse(task, today));

    return buildPaginatedResult(mapped, limit);
  }

  async getTaskById(
    tenantId: string,
    taskId: string,
  ) {
    if (!TasksService.UUID_REGEX.test(taskId)) {
      throw new NotFoundException(`Task with id ${taskId} not found`);
    }

    const task = await this.prisma.maintenanceTask.findFirst({
      where: { id: taskId, tenantId },
      include: {
        vehicles: {
          include: {
            vehicleJobs: true,
            workshop: true,
            cancellationReason: true,
            rescheduleReason: true,
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

    return this.buildTaskResponse(task, today);
  }

  async getBulkVehicleMaintenance(
    tenantId: string,
    dto: BulkVehicleMaintenanceDto,
    query: BulkVehicleMaintenanceQueryDto,
  ) {
    const taskVehicles = await this.prisma.maintenanceTaskVehicle.findMany({
      where: {
        tenantId,
        vehicleId: { in: dto.vehicleIds },
      },
      include: {
        task: {
          include: {
            jobs: { orderBy: { sortOrder: 'asc' } },
          },
        },
        vehicleJobs: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Group by vehicleId
    const vehicleMap = new Map<number, typeof taskVehicles>();
    for (const tv of taskVehicles) {
      const list = vehicleMap.get(tv.vehicleId) || [];
      list.push(tv);
      vehicleMap.set(tv.vehicleId, list);
    }

    // Build response for each requested vehicle
    let vehicles = dto.vehicleIds.map((vehicleId) => {
      const entries = vehicleMap.get(vehicleId) || [];
      const hasOpenTask = entries.some((e) => e.status === 'open');

      return {
        vehicleId,
        status: hasOpenTask ? ('active' as const) : ('inactive' as const),
        tasks: entries.map((tv) => ({
          taskId: tv.taskId,
          title: tv.task.title,
          maintenanceType: tv.task.maintenanceType,
          vehicleStatus: tv.status,
          dueDate: tv.dueDate,
          dueOdometerKm: tv.dueOdometerKm,
          completionDate: tv.completionDate,
          actualOdometerKm: tv.actualOdometerKm,
          createdAt: tv.createdAt,
          jobs: tv.vehicleJobs.map((vj) => ({
            jobCode: vj.jobCode,
            status: vj.status,
          })),
        })),
      };
    });

    // Apply status filter
    if (query.status === VehicleActivityFilterDto.active) {
      vehicles = vehicles.filter((v) => v.status === 'active');
    } else if (query.status === VehicleActivityFilterDto.inactive) {
      vehicles = vehicles.filter((v) => v.status === 'inactive');
    }

    return { data: vehicles };
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

    const vehicleTasks = (await this.prisma.maintenanceTaskVehicle.findMany({
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
    })) as (MaintenanceTaskVehicle & {
      task: MaintenanceTask;
      vehicleJobs: any[];
      workshop: any;
      cancellationReason: any;
    })[];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const mappedResults = vehicleTasks.map((vt) => {
      let overdue = false;
      let overdueComputation: 'computed' | 'insufficient_data' | 'not_applicable' = 'not_applicable';

      if (vt.status === 'open' && vt.task.maintenanceType === 'preventive') {
        if (vt.dueDate) {
          const dueDate = new Date(vt.dueDate);
          dueDate.setHours(0, 0, 0, 0);
          overdue = dueDate < today;
          overdueComputation = 'computed';
        } else {
          overdue = false;
          overdueComputation = 'insufficient_data';
        }
      }

      return {
        id: `${vt.taskId}_${vt.vehicleId}`,
        taskId: vt.taskId,
        taskTitle: vt.task.title,
        maintenanceType: vt.task.maintenanceType,
        vehicleId: vt.vehicleId,
        status: vt.status,
        dueOdometerKm: vt.dueOdometerKm ?? null,
        dueDate: vt.dueDate ?? null,
        completionDate: vt.completionDate ?? null,
        actualOdometerKm: vt.actualOdometerKm ?? null,
        workshopId: vt.workshopId ?? null,
        workshopCustom: vt.workshopCustom ?? null,
        costAmount: vt.costAmount ?? null,
        costCurrency: vt.costCurrency ?? null,
        cancellationDate: vt.cancellationDate ?? null,
        cancellationReasonId: vt.cancellationReasonId ?? null,
        cancellationReasonCustom: vt.cancellationReasonCustom ?? null,
        rescheduleOriginalDueDate: vt.rescheduleOriginalDueDate ?? null,
        rescheduleNewDueDate: vt.rescheduleNewDueDate ?? null,
        rescheduleOdometerKm: vt.rescheduleOdometerKm ?? null,
        rescheduleReasonId: vt.rescheduleReasonId ?? null,
        rescheduleReasonCustom: vt.rescheduleReasonCustom ?? null,
        overdue,
        overdueComputation,
        jobs: vt.vehicleJobs.map((j: any) => ({ jobCode: j.jobCode, status: j.status })),
        createdAt: vt.createdAt,
        updatedAt: vt.updatedAt,
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
  ) {
    const task = await this.getTaskByIdInternal(tenantId, taskId);
    const taskVehicle = await this.getTaskVehicle(tenantId, taskId, vehicleId);

    if (taskVehicle.status !== 'open' && taskVehicle.status !== 'rescheduled') {
      throw new ConflictException(
        `Vehicle is already ${taskVehicle.status}. Use corrections endpoint to modify.`,
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
      action: 'complete',
      actor,
      previousValue: previousValue as unknown as Record<string, unknown>,
      newValue: { vehicleId, status: 'completed', ...dto },
    });

    const updated = await this.prisma.maintenanceTaskVehicle.findFirst({
      where: { tenantId, taskId, vehicleId },
      include: { vehicleJobs: true },
    });
    return this.buildVehicleResponse(task, updated!);
  }

  async cancelVehicle(
    tenantId: string,
    taskId: string,
    vehicleId: number,
    dto: CancelVehicleDto,
    actor: string,
  ) {
    const task = await this.getTaskByIdInternal(tenantId, taskId);
    const taskVehicle = await this.getTaskVehicle(tenantId, taskId, vehicleId);

    if (taskVehicle.status !== 'open' && taskVehicle.status !== 'rescheduled') {
      throw new ConflictException(
        `Vehicle is already ${taskVehicle.status}. Use corrections endpoint to modify.`,
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
      action: 'cancel',
      actor,
      previousValue: previousValue as unknown as Record<string, unknown>,
      newValue: { vehicleId, status: 'cancelled', ...dto },
    });

    const updated = await this.prisma.maintenanceTaskVehicle.findFirst({
      where: { tenantId, taskId, vehicleId },
      include: { vehicleJobs: true },
    });
    return this.buildVehicleResponse(task, updated!);
  }

  async rescheduleVehicle(
    tenantId: string,
    taskId: string,
    vehicleId: number,
    dto: RescheduleVehicleDto,
    actor: string,
  ) {
    const task = await this.getTaskByIdInternal(tenantId, taskId);
    const taskVehicle = await this.getTaskVehicle(tenantId, taskId, vehicleId);

    if (taskVehicle.status !== 'open') {
      throw new ConflictException(
        `Vehicle is already ${taskVehicle.status}. Use corrections endpoint to modify.`,
      );
    }

    let rescheduleReasonId: string | null = null;
    let rescheduleReasonCustom: string | null = null;

    if (dto.rescheduleReason.mode === RescheduleReasonModeDto.master) {
      if (!dto.rescheduleReason.reasonId) {
        throw new BadRequestException(
          'reasonId is required when mode is master',
        );
      }
      await this.referenceService.getReasonById(
        dto.rescheduleReason.reasonId,
        tenantId,
      );
      rescheduleReasonId = dto.rescheduleReason.reasonId;
    } else {
      if (!dto.rescheduleReason.customReason) {
        throw new BadRequestException(
          'customReason is required when mode is custom',
        );
      }
      rescheduleReasonCustom = dto.rescheduleReason.customReason;
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
        rescheduleReasonId,
        rescheduleReasonCustom,
      },
    });

    await this.auditService.log({
      tenantId,
      entityType: 'task_vehicle',
      entityId: taskId,
      action: 'reschedule',
      actor,
      previousValue: previousValue as unknown as Record<string, unknown>,
      newValue: { vehicleId, status: 'rescheduled', ...dto },
    });

    const updated = await this.prisma.maintenanceTaskVehicle.findFirst({
      where: { tenantId, taskId, vehicleId },
      include: { vehicleJobs: true },
    });
    return this.buildVehicleResponse(task, updated!);
  }

  async applyCorrection(
    tenantId: string,
    taskId: string,
    vehicleId: number,
    dto: CorrectionDto,
    actor: string,
  ) {
    const task = await this.getTaskByIdInternal(tenantId, taskId);
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
      'rescheduleReasonId',
      'rescheduleReasonCustom',
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

    const auditEntry = await this.auditService.log({
      tenantId,
      entityType: 'task_vehicle',
      entityId: taskId,
      action: 'correction',
      actor,
      previousValue: previousValue as unknown as Record<string, unknown>,
      newValue: {
        vehicleId,
        correctionReason: dto.correctionReason,
        changes: dto.patch,
      },
    });

    const updated = await this.prisma.maintenanceTaskVehicle.findFirst({
      where: { tenantId, taskId, vehicleId },
      include: { vehicleJobs: true },
    });

    return {
      success: true,
      correctionId: auditEntry.id,
      vehicle: this.buildVehicleResponse(task, updated!),
    };
  }

  private buildVehicleResponse(task: MaintenanceTask, v: MaintenanceTaskVehicle & { vehicleJobs?: any[] }) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let overdue = false;
    let overdueComputation: 'computed' | 'insufficient_data' | 'not_applicable' = 'not_applicable';

    if (v.status === 'open' && task.maintenanceType === 'preventive') {
      if (v.dueDate) {
        const dueDate = new Date(v.dueDate);
        dueDate.setHours(0, 0, 0, 0);
        overdue = dueDate < today;
        overdueComputation = 'computed';
      } else {
        overdue = false;
        overdueComputation = 'insufficient_data';
      }
    }

    return {
      id: `${v.taskId}_${v.vehicleId}`,
      vehicleId: v.vehicleId,
      status: v.status,
      dueOdometerKm: v.dueOdometerKm ?? null,
      dueDate: v.dueDate ?? null,
      completionDate: v.completionDate ?? null,
      actualOdometerKm: v.actualOdometerKm ?? null,
      workshopId: v.workshopId ?? null,
      workshopCustom: v.workshopCustom ?? null,
      costAmount: v.costAmount ?? null,
      costCurrency: v.costCurrency ?? null,
      cancellationDate: v.cancellationDate ?? null,
      cancellationReasonId: v.cancellationReasonId ?? null,
      cancellationReasonCustom: v.cancellationReasonCustom ?? null,
      rescheduleOriginalDueDate: v.rescheduleOriginalDueDate ?? null,
      rescheduleNewDueDate: v.rescheduleNewDueDate ?? null,
      rescheduleOdometerKm: v.rescheduleOdometerKm ?? null,
      rescheduleReasonId: v.rescheduleReasonId ?? null,
      rescheduleReasonCustom: v.rescheduleReasonCustom ?? null,
      overdue,
      overdueComputation,
      jobs: (v.vehicleJobs || []).map((j: any) => ({
        jobCode: j.jobCode,
        status: j.status,
      })),
      createdAt: v.createdAt,
      updatedAt: v.updatedAt,
    };
  }

  private buildTaskResponse(task: any, today: Date) {
    return {
      id: task.id,
      title: task.title,
      maintenanceType: task.maintenanceType,
      triggerMode: task.triggerMode ?? null,
      triggerKm: task.triggerKm ?? null,
      triggerDate: task.triggerDate ?? null,
      remindBeforeKm: task.remindBeforeKm ?? null,
      remindBeforeDays: task.remindBeforeDays ?? null,
      notes: task.notes ?? null,
      sourceGroupId: task.sourceGroupId ?? null,
      selectionContext: task.selectionContext ?? null,
      checklist: (task.jobs || []).map((j: any) => ({
        jobCode: j.jobCode,
        label: j.label,
        sortOrder: j.sortOrder,
      })),
      completion: task.vehicles.length > 0 && task.vehicles.every((v: any) => v.status !== 'open')
        ? 'completed'
        : 'incompleted',
      vehicles: task.vehicles.map((v: any) => this.buildVehicleResponse(task, v)),
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    };
  }

  private static readonly UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  private async getTaskByIdInternal(
    tenantId: string,
    taskId: string,
  ): Promise<MaintenanceTask> {
    if (!TasksService.UUID_REGEX.test(taskId)) {
      throw new NotFoundException(`Task with id ${taskId} not found`);
    }

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
