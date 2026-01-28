import { PrismaClient } from '@prisma/client';
import { cleanupTenantData } from '../fixtures/seed';
import { UUIDS } from '../fixtures/uuids';

/**
 * Returns the global Prisma client instance.
 */
export function getPrisma(): PrismaClient {
  if (!global.__PRISMA_TEST__) {
    throw new Error(
      'Prisma client not initialized. Ensure setup.ts runs first.',
    );
  }
  return global.__PRISMA_TEST__;
}

/**
 * Cleans up tenant data between tests.
 */
export async function cleanupTenant(tenantId: string): Promise<void> {
  const prisma = getPrisma();
  await cleanupTenantData(prisma, tenantId);
}

/**
 * Cleans up data for both test tenants.
 */
export async function cleanupAllTenants(): Promise<void> {
  await cleanupTenant(UUIDS.tenants.A);
  await cleanupTenant(UUIDS.tenants.B);
}

/**
 * Creates a task directly in the database for test setup.
 */
export async function createTaskDirect(
  tenantId: string,
  data: {
    id?: string;
    title: string;
    maintenanceType: 'preventive' | 'corrective';
    triggerMode?: 'mileage' | 'time' | 'both';
    triggerKm?: number;
    notes?: string;
  },
): Promise<{ id: string }> {
  const prisma = getPrisma();
  return prisma.maintenanceTask.create({
    data: {
      id: data.id,
      tenantId,
      title: data.title,
      maintenanceType: data.maintenanceType,
      triggerMode: data.triggerMode,
      triggerKm: data.triggerKm,
      notes: data.notes,
      createdBy: 'contract-test',
    },
    select: { id: true },
  });
}

/**
 * Creates a task vehicle directly in the database.
 */
export async function createTaskVehicleDirect(
  tenantId: string,
  taskId: string,
  vehicleId: string,
  data?: {
    status?: 'open' | 'completed' | 'cancelled' | 'rescheduled';
    dueOdometerKm?: number;
    dueDate?: Date;
    actualOdometerKm?: number;
    completionDate?: Date;
    workshopId?: string;
    workshopCustom?: string;
    costAmount?: number;
    cancellationDate?: Date;
    cancellationReasonId?: string;
    cancellationReasonCustom?: string;
    rescheduleOriginalDueDate?: Date;
    rescheduleNewDueDate?: Date;
    rescheduleReason?: string;
    rescheduleOdometerKm?: number;
  },
): Promise<void> {
  const prisma = getPrisma();
  await prisma.maintenanceTaskVehicle.create({
    data: {
      tenantId,
      taskId,
      vehicleId,
      status: data?.status || 'open',
      dueOdometerKm: data?.dueOdometerKm,
      dueDate: data?.dueDate,
      actualOdometerKm: data?.actualOdometerKm,
      completionDate: data?.completionDate,
      workshopId: data?.workshopId,
      workshopCustom: data?.workshopCustom,
      costAmount: data?.costAmount,
      cancellationDate: data?.cancellationDate,
      cancellationReasonId: data?.cancellationReasonId,
      cancellationReasonCustom: data?.cancellationReasonCustom,
      rescheduleOriginalDueDate: data?.rescheduleOriginalDueDate,
      rescheduleNewDueDate: data?.rescheduleNewDueDate,
      rescheduleReason: data?.rescheduleReason,
      rescheduleOdometerKm: data?.rescheduleOdometerKm,
    },
  });
}

/**
 * Creates a task job directly in the database.
 */
export async function createTaskJobDirect(
  tenantId: string,
  taskId: string,
  data: {
    jobCode: string;
    label: string;
    sortOrder: number;
  },
): Promise<void> {
  const prisma = getPrisma();
  await prisma.maintenanceTaskJob.create({
    data: {
      tenantId,
      taskId,
      jobCode: data.jobCode,
      label: data.label,
      sortOrder: data.sortOrder,
    },
  });
}

/**
 * Gets a task vehicle from the database.
 */
export async function getTaskVehicleDirect(
  tenantId: string,
  taskId: string,
  vehicleId: string,
): Promise<{
  status: string;
  actualOdometerKm: number | null;
  completionDate: Date | null;
  workshopId: string | null;
  workshopCustom: string | null;
  costAmount: number | null;
  cancellationDate: Date | null;
  cancellationReasonId: string | null;
  cancellationReasonCustom: string | null;
} | null> {
  const prisma = getPrisma();
  const vehicle = await prisma.maintenanceTaskVehicle.findUnique({
    where: {
      tenantId_taskId_vehicleId: { tenantId, taskId, vehicleId },
    },
    select: {
      status: true,
      actualOdometerKm: true,
      completionDate: true,
      workshopId: true,
      workshopCustom: true,
      costAmount: true,
      cancellationDate: true,
      cancellationReasonId: true,
      cancellationReasonCustom: true,
    },
  });

  if (!vehicle) return null;

  return {
    ...vehicle,
    costAmount: vehicle.costAmount ? Number(vehicle.costAmount) : null,
  };
}

/**
 * Counts audit log entries for an entity.
 */
export async function countAuditLogs(
  tenantId: string,
  entityType: string,
  entityId: string,
  action?: string,
): Promise<number> {
  const prisma = getPrisma();
  return prisma.maintenanceAuditLog.count({
    where: {
      tenantId,
      entityType: entityType as any,
      entityId,
      ...(action && { action }),
    },
  });
}

/**
 * Gets the latest audit log entry for an entity.
 */
export async function getLatestAuditLog(
  tenantId: string,
  entityType: string,
  entityId: string,
): Promise<{
  action: string;
  actor: string;
  previousValue: any;
  newValue: any;
} | null> {
  const prisma = getPrisma();
  return prisma.maintenanceAuditLog.findFirst({
    where: {
      tenantId,
      entityType: entityType as any,
      entityId,
    },
    orderBy: { timestamp: 'desc' },
    select: {
      action: true,
      actor: true,
      previousValue: true,
      newValue: true,
    },
  });
}

/**
 * Creates an upload directly in the database for test setup.
 */
export async function createUploadDirect(
  tenantId: string,
  data: {
    id?: string;
    objectKey: string;
    fileUrl: string;
    fileName: string;
    contentType: string;
    fileSize: number;
    uploadedBy?: string;
    claimedAt?: Date | null;
  },
): Promise<{ id: string }> {
  const prisma = getPrisma();
  return prisma.upload.create({
    data: {
      id: data.id,
      tenantId,
      objectKey: data.objectKey,
      fileUrl: data.fileUrl,
      fileName: data.fileName,
      contentType: data.contentType,
      fileSize: data.fileSize,
      uploadedBy: data.uploadedBy || 'contract-test',
      claimedAt: data.claimedAt,
    },
    select: { id: true },
  });
}

/**
 * Gets an upload from the database.
 */
export async function getUploadDirect(uploadId: string): Promise<{
  id: string;
  tenantId: string;
  objectKey: string;
  fileUrl: string;
  fileName: string;
  contentType: string;
  fileSize: bigint;
  claimedAt: Date | null;
} | null> {
  const prisma = getPrisma();
  return prisma.upload.findUnique({
    where: { id: uploadId },
    select: {
      id: true,
      tenantId: true,
      objectKey: true,
      fileUrl: true,
      fileName: true,
      contentType: true,
      fileSize: true,
      claimedAt: true,
    },
  });
}
