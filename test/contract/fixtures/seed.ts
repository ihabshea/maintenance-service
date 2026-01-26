import { PrismaClient } from '@prisma/client';
import { UUIDS } from './uuids';

/**
 * Seeds system reference data for contract tests.
 * This data represents the global/system-scoped data visible to all tenants.
 */
export async function seedSystemData(prisma: PrismaClient): Promise<void> {
  // Seed system workshops
  await prisma.workshop.upsert({
    where: { id: UUIDS.workshops.SYSTEM_MAIN },
    update: {},
    create: {
      id: UUIDS.workshops.SYSTEM_MAIN,
      scope: 'system',
      tenantId: null,
      name: 'Main Service Center',
      location: 'Cairo, Egypt',
      status: 'active',
    },
  });

  await prisma.workshop.upsert({
    where: { id: UUIDS.workshops.SYSTEM_QUICK },
    update: {},
    create: {
      id: UUIDS.workshops.SYSTEM_QUICK,
      scope: 'system',
      tenantId: null,
      name: 'Quick Service Station',
      location: 'Alexandria, Egypt',
      status: 'active',
    },
  });

  await prisma.workshop.upsert({
    where: { id: UUIDS.workshops.SYSTEM_DEALER },
    update: {},
    create: {
      id: UUIDS.workshops.SYSTEM_DEALER,
      scope: 'system',
      tenantId: null,
      name: 'Dealer Workshop',
      location: 'Giza, Egypt',
      status: 'active',
    },
  });

  // Seed system reasons
  await prisma.reason.upsert({
    where: { id: UUIDS.reasons.SYSTEM_SOLD },
    update: {},
    create: {
      id: UUIDS.reasons.SYSTEM_SOLD,
      scope: 'system',
      tenantId: null,
      reasonType: 'cancellation',
      label: 'Vehicle sold',
      status: 'active',
    },
  });

  await prisma.reason.upsert({
    where: { id: UUIDS.reasons.SYSTEM_DECOMMISSIONED },
    update: {},
    create: {
      id: UUIDS.reasons.SYSTEM_DECOMMISSIONED,
      scope: 'system',
      tenantId: null,
      reasonType: 'cancellation',
      label: 'Vehicle decommissioned',
      status: 'active',
    },
  });
}

/**
 * Seeds tenant-specific reference data for contract tests.
 */
export async function seedTenantData(
  prisma: PrismaClient,
  tenantId: string,
): Promise<void> {
  const workshopId =
    tenantId === UUIDS.tenants.A
      ? UUIDS.workshops.TENANT_A
      : UUIDS.workshops.TENANT_B;

  const reasonId =
    tenantId === UUIDS.tenants.A
      ? UUIDS.reasons.TENANT_A
      : UUIDS.reasons.TENANT_B;

  // Seed tenant workshop
  await prisma.workshop.upsert({
    where: { id: workshopId },
    update: {},
    create: {
      id: workshopId,
      scope: 'tenant',
      tenantId,
      name: `Tenant ${tenantId === UUIDS.tenants.A ? 'A' : 'B'} Workshop`,
      location: 'Private Location',
      status: 'active',
    },
  });

  // Seed tenant reason
  await prisma.reason.upsert({
    where: { id: reasonId },
    update: {},
    create: {
      id: reasonId,
      scope: 'tenant',
      tenantId,
      reasonType: 'cancellation',
      label: `Tenant ${tenantId === UUIDS.tenants.A ? 'A' : 'B'} Custom Reason`,
      status: 'active',
    },
  });
}

/**
 * Cleans up tenant-specific data between test runs.
 * Preserves system reference data.
 */
export async function cleanupTenantData(
  prisma: PrismaClient,
  tenantId: string,
): Promise<void> {
  // Delete in order to respect foreign key constraints
  await prisma.maintenanceAuditLog.deleteMany({ where: { tenantId } });
  await prisma.maintenanceAttachment.deleteMany({ where: { tenantId } });
  await prisma.maintenanceTaskVehicleJob.deleteMany({ where: { tenantId } });
  await prisma.maintenanceTaskVehicle.deleteMany({ where: { tenantId } });
  await prisma.maintenanceTaskJob.deleteMany({ where: { tenantId } });
  await prisma.maintenanceTask.deleteMany({ where: { tenantId } });
  // Keep tenant workshops and reasons for reference tests
}

/**
 * Full cleanup of tenant data including reference data.
 */
export async function fullCleanupTenantData(
  prisma: PrismaClient,
  tenantId: string,
): Promise<void> {
  await cleanupTenantData(prisma, tenantId);
  await prisma.workshop.deleteMany({ where: { tenantId } });
  await prisma.reason.deleteMany({ where: { tenantId } });
}

/**
 * Cleans up all test data for both tenants.
 */
export async function cleanupAllTestData(prisma: PrismaClient): Promise<void> {
  await fullCleanupTenantData(prisma, UUIDS.tenants.A);
  await fullCleanupTenantData(prisma, UUIDS.tenants.B);
}
