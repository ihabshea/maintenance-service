import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ReportFiltersDto } from './dto/report-filters.dto';
import { MaintenanceType, TaskVehicleStatus, Prisma } from '@prisma/client';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getMaintenanceStatusReport(
    tenantId: string,
    filters: ReportFiltersDto,
  ) {
    const dateFilter = this.buildDateFilter(filters);
    const vehicleFilter = filters.vehicleId
      ? { vehicleId: filters.vehicleId }
      : {};
    const typeFilter = filters.maintenanceType
      ? {
          task: { maintenanceType: filters.maintenanceType as MaintenanceType },
        }
      : {};

    const baseWhere: Prisma.MaintenanceTaskVehicleWhereInput = {
      tenantId,
      ...vehicleFilter,
      ...typeFilter,
      ...dateFilter,
    };

    const [completed, cancelled, rescheduled] = await Promise.all([
      this.prisma.maintenanceTaskVehicle.findMany({
        where: { ...baseWhere, status: TaskVehicleStatus.completed },
        include: { task: true, workshop: true },
        orderBy: { completionDate: 'desc' },
      }),
      this.prisma.maintenanceTaskVehicle.findMany({
        where: { ...baseWhere, status: TaskVehicleStatus.cancelled },
        include: { task: true, cancellationReason: true },
        orderBy: { cancellationDate: 'desc' },
      }),
      this.prisma.maintenanceTaskVehicle.findMany({
        where: { ...baseWhere, status: TaskVehicleStatus.rescheduled },
        include: { task: true, rescheduleReason: true },
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

    return {
      completed: completed.map((v) => ({
        taskId: v.taskId,
        vehicleId: v.vehicleId,
        title: v.task.title,
        timestamp: v.completionDate,
        km: v.actualOdometerKm,
        value: v.costAmount ? Number(v.costAmount) : null,
        currency: v.costCurrency,
        workshop: v.workshop?.name ?? v.workshopCustom ?? null,
        location: v.workshop?.location ?? null,
      })),
      cancelled: cancelled.map((v) => ({
        taskId: v.taskId,
        vehicleId: v.vehicleId,
        title: v.task.title,
        timestamp: v.cancellationDate,
        km: v.actualOdometerKm,
        reason:
          v.cancellationReason?.label ?? v.cancellationReasonCustom ?? null,
      })),
      rescheduled: rescheduled.map((v) => ({
        taskId: v.taskId,
        vehicleId: v.vehicleId,
        title: v.task.title,
        timestamp: v.updatedAt,
        km: v.rescheduleOdometerKm,
        rescheduledDate: v.rescheduleNewDueDate,
        reason:
          v.rescheduleReason?.label ?? v.rescheduleReasonCustom ?? null,
      })),
    };
  }

  async getOverduePreventiveReport(
    tenantId: string,
    filters: ReportFiltersDto,
  ) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const vehicleFilter = filters.vehicleId
      ? { vehicleId: filters.vehicleId }
      : {};

    const overdueVehicles = await this.prisma.maintenanceTaskVehicle.findMany({
      where: {
        tenantId,
        status: TaskVehicleStatus.open,
        task: { maintenanceType: MaintenanceType.preventive },
        dueDate: { lt: today },
        ...vehicleFilter,
      },
      include: { task: true },
      orderBy: { dueDate: 'asc' },
    });

    return overdueVehicles.map((v) => {
      const dueDate = v.dueDate!;
      const overdueDays = Math.floor(
        (today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      return {
        taskId: v.taskId,
        vehicleId: v.vehicleId,
        title: v.task.title,
        dueDate: v.dueDate,
        dueOdometerKm: v.dueOdometerKm,
        overdueSince: v.dueDate,
        overdueDays,
      };
    });
  }

  async getCostSummaryReport(tenantId: string, filters: ReportFiltersDto) {
    const dateFilter = this.buildDateFilter(filters);
    const vehicleFilter = filters.vehicleId
      ? { vehicleId: filters.vehicleId }
      : {};
    const typeFilter = filters.maintenanceType
      ? {
          task: { maintenanceType: filters.maintenanceType as MaintenanceType },
        }
      : {};
    const statusFilter = filters.status
      ? { status: filters.status as TaskVehicleStatus }
      : {};

    const baseWhere: Prisma.MaintenanceTaskVehicleWhereInput = {
      tenantId,
      costAmount: { not: null },
      ...vehicleFilter,
      ...typeFilter,
      ...statusFilter,
      ...dateFilter,
    };

    const [aggregate, byStatus] = await Promise.all([
      this.prisma.maintenanceTaskVehicle.aggregate({
        where: baseWhere,
        _sum: { costAmount: true },
        _count: true,
        _avg: { costAmount: true },
      }),
      this.prisma.maintenanceTaskVehicle.groupBy({
        by: ['status'],
        where: baseWhere,
        _sum: { costAmount: true },
        _count: true,
      }),
    ]);

    return {
      totalCost: aggregate._sum.costAmount
        ? Number(aggregate._sum.costAmount)
        : 0,
      totalCount: aggregate._count,
      averageCost: aggregate._avg.costAmount
        ? Number(aggregate._avg.costAmount)
        : 0,
      byStatus: byStatus.map((s) => ({
        status: s.status,
        totalCost: s._sum.costAmount ? Number(s._sum.costAmount) : 0,
        count: s._count,
      })),
    };
  }

  async getCorrectiveVsPreventiveReport(
    tenantId: string,
    filters: ReportFiltersDto,
  ) {
    const dateFilter = this.buildDateFilter(filters);
    const vehicleFilter = filters.vehicleId
      ? { vehicleId: filters.vehicleId }
      : {};
    const statusFilter = filters.status
      ? { status: filters.status as TaskVehicleStatus }
      : {};

    const baseWhere: Prisma.MaintenanceTaskVehicleWhereInput = {
      tenantId,
      ...vehicleFilter,
      ...statusFilter,
      ...dateFilter,
    };

    const [preventive, corrective] = await Promise.all([
      this.prisma.maintenanceTaskVehicle.aggregate({
        where: {
          ...baseWhere,
          task: { maintenanceType: MaintenanceType.preventive },
        },
        _count: true,
        _sum: { costAmount: true },
      }),
      this.prisma.maintenanceTaskVehicle.aggregate({
        where: {
          ...baseWhere,
          task: { maintenanceType: MaintenanceType.corrective },
        },
        _count: true,
        _sum: { costAmount: true },
      }),
    ]);

    const preventiveCount = preventive._count;
    const correctiveCount = corrective._count;
    const ratio =
      correctiveCount > 0
        ? (preventiveCount / correctiveCount).toFixed(2)
        : '0.00';

    return {
      preventive: {
        count: preventiveCount,
        totalCost: preventive._sum.costAmount
          ? Number(preventive._sum.costAmount)
          : 0,
      },
      corrective: {
        count: correctiveCount,
        totalCost: corrective._sum.costAmount
          ? Number(corrective._sum.costAmount)
          : 0,
      },
      ratio,
    };
  }

  private buildDateFilter(
    filters: ReportFiltersDto,
  ): Prisma.MaintenanceTaskVehicleWhereInput {
    if (!filters.fromDate && !filters.toDate) {
      return {};
    }

    const createdAtFilter: Prisma.DateTimeFilter = {};

    if (filters.fromDate) {
      createdAtFilter.gte = new Date(filters.fromDate);
    }

    if (filters.toDate) {
      const toDate = new Date(filters.toDate);
      toDate.setHours(23, 59, 59, 999);
      createdAtFilter.lte = toDate;
    }

    return { createdAt: createdAtFilter };
  }
}
