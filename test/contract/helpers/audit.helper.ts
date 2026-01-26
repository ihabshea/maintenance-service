import { getPrisma, getLatestAuditLog, countAuditLogs } from './prisma.helper';

/**
 * Audit log verification helpers for contract tests.
 */

export type AuditEntityType =
  | 'task'
  | 'task_vehicle'
  | 'workshop'
  | 'reason'
  | 'attachment';

export interface AuditLogEntry {
  action: string;
  actor: string;
  previousValue: any;
  newValue: any;
}

/**
 * Verifies that an audit log entry was created for a specific action.
 */
export async function verifyAuditLogCreated(
  tenantId: string,
  entityType: AuditEntityType,
  entityId: string,
  expectedAction: string,
  expectedActor?: string,
): Promise<void> {
  const auditLog = await getLatestAuditLog(tenantId, entityType, entityId);

  expect(auditLog).not.toBeNull();
  expect(auditLog?.action).toBe(expectedAction);

  if (expectedActor) {
    expect(auditLog?.actor).toBe(expectedActor);
  }
}

/**
 * Verifies the create audit entry for a new entity.
 * Note: The action name is 'created' for workshop, reason, attachment.
 * For task it's also 'created'.
 */
export async function verifyCreateAudit(
  tenantId: string,
  entityType: AuditEntityType,
  entityId: string,
  expectedActor?: string,
): Promise<void> {
  const auditLog = await getLatestAuditLog(tenantId, entityType, entityId);

  expect(auditLog).not.toBeNull();
  expect(auditLog?.action).toBe('created');
  expect(auditLog?.previousValue).toBeNull();
  expect(auditLog?.newValue).not.toBeNull();

  if (expectedActor) {
    expect(auditLog?.actor).toBe(expectedActor);
  }
}

/**
 * Verifies the status transition audit entry.
 * Note: For task_vehicle audits, the entityId is the taskId, not vehicleId.
 * The action names are: status_completed, status_cancelled, status_rescheduled
 */
export async function verifyStatusTransitionAudit(
  tenantId: string,
  taskId: string,
  expectedAction: string,
  expectedPreviousStatus: string,
  expectedNewStatus: string,
): Promise<void> {
  const auditLog = await getLatestAuditLog(tenantId, 'task_vehicle', taskId);

  expect(auditLog).not.toBeNull();
  expect(auditLog?.action).toBe(expectedAction);
  expect(auditLog?.previousValue?.status).toBe(expectedPreviousStatus);
  expect(auditLog?.newValue?.status).toBe(expectedNewStatus);
}

/**
 * Verifies the correction audit entry.
 * Note: The action is 'correction_applied', not 'correction'.
 */
export async function verifyCorrectionAudit(
  tenantId: string,
  taskId: string,
  expectedCorrectionReason: string,
): Promise<void> {
  const auditLog = await getLatestAuditLog(tenantId, 'task_vehicle', taskId);

  expect(auditLog).not.toBeNull();
  expect(auditLog?.action).toBe('correction_applied');
  expect(auditLog?.newValue?.correctionReason).toBe(expectedCorrectionReason);
}

/**
 * Counts the number of audit entries for an entity.
 */
export async function getAuditCount(
  tenantId: string,
  entityType: AuditEntityType,
  entityId: string,
  action?: string,
): Promise<number> {
  return countAuditLogs(tenantId, entityType, entityId, action);
}

/**
 * Gets all audit logs for an entity.
 */
export async function getAuditHistory(
  tenantId: string,
  entityType: AuditEntityType,
  entityId: string,
): Promise<AuditLogEntry[]> {
  const prisma = getPrisma();
  return prisma.maintenanceAuditLog.findMany({
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
 * Verifies that no audit log was created for an entity.
 */
export async function verifyNoAuditLog(
  tenantId: string,
  entityType: AuditEntityType,
  entityId: string,
): Promise<void> {
  const count = await countAuditLogs(tenantId, entityType, entityId);
  expect(count).toBe(0);
}

/**
 * Verifies the exact number of audit entries for an entity.
 */
export async function verifyAuditCount(
  tenantId: string,
  entityType: AuditEntityType,
  entityId: string,
  expectedCount: number,
): Promise<void> {
  const count = await countAuditLogs(tenantId, entityType, entityId);
  expect(count).toBe(expectedCount);
}

/**
 * Composite key helper for task_vehicle entity IDs.
 * The entity ID for task vehicles is typically the vehicleId.
 */
export function getTaskVehicleEntityId(
  taskId: string,
  vehicleId: string,
): string {
  // The audit service uses vehicleId as entityId for task_vehicle entries
  return vehicleId;
}
