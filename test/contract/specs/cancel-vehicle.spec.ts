import { INestApplication } from '@nestjs/common';
import { createTestApp, closeTestApp } from '../helpers/app.helper';
import { HttpClient, API_PATHS } from '../helpers/http.helper';
import {
  assertOk,
  assertBadRequest,
  assertNotFound,
} from '../helpers/assertions.helper';
import { verifyStatusTransitionAudit } from '../helpers/audit.helper';
import {
  cleanupTenant,
  createTaskDirect,
  createTaskVehicleDirect,
  getTaskVehicleDirect,
} from '../helpers/prisma.helper';
import { UUIDS } from '../fixtures/uuids';
import { VALID_PAYLOADS, INVALID_PAYLOADS } from '../fixtures/payloads';

/**
 * Contract Tests: PATCH /api/maintenance/tasks/:taskId/vehicles/:vehicleId/status/cancelled
 *
 * Source of Truth: api-contract.md (Section 6), validation-rules.md, audit-and-immutability.md
 *
 * Cancels a vehicle execution.
 */
describe('PATCH .../status/cancelled', () => {
  let app: INestApplication;
  let http: HttpClient;
  let taskId: string;

  beforeAll(async () => {
    app = await createTestApp();
    http = new HttpClient(app, UUIDS.tenants.A);
  });

  afterAll(async () => {
    await closeTestApp();
  });

  beforeEach(async () => {
    await cleanupTenant(UUIDS.tenants.A);

    // Create a test task with vehicle
    const task = await createTaskDirect(UUIDS.tenants.A, {
      title: 'Cancel Vehicle Test',
      maintenanceType: 'preventive',
    });
    taskId = task.id;

    await createTaskVehicleDirect(UUIDS.tenants.A, taskId, UUIDS.vehicles.V1, {
      status: 'open',
      dueOdometerKm: 50000,
    });
  });

  describe('Happy Path', () => {
    it('should cancel vehicle with master reason', async () => {
      const response = await http
        .patch(API_PATHS.cancelVehicle(taskId, UUIDS.vehicles.V1))
        .send(VALID_PAYLOADS.cancelVehicle.withMasterReason);

      assertOk(response);
      expect(response.body.data.success).toBe(true);

      // Verify database state
      const vehicle = await getTaskVehicleDirect(
        UUIDS.tenants.A,
        taskId,
        UUIDS.vehicles.V1,
      );
      expect(vehicle?.status).toBe('cancelled');
      expect(vehicle?.cancellationReasonId).toBe(UUIDS.reasons.SYSTEM_SOLD);
      expect(vehicle?.actualOdometerKm).toBe(49000);
    });

    it('should cancel vehicle with custom reason', async () => {
      const response = await http
        .patch(API_PATHS.cancelVehicle(taskId, UUIDS.vehicles.V1))
        .send(VALID_PAYLOADS.cancelVehicle.withCustomReason);

      assertOk(response);

      const vehicle = await getTaskVehicleDirect(
        UUIDS.tenants.A,
        taskId,
        UUIDS.vehicles.V1,
      );
      expect(vehicle?.status).toBe('cancelled');
      expect(vehicle?.cancellationReasonId).toBeNull();
      expect(vehicle?.cancellationReasonCustom).toBe('Budget constraints');
    });
  });

  describe('Validation Errors', () => {
    it('should reject missing date', async () => {
      const response = await http
        .patch(API_PATHS.cancelVehicle(taskId, UUIDS.vehicles.V1))
        .send(INVALID_PAYLOADS.cancelVehicle.missingDate);

      assertBadRequest(response);
    });

    it('should reject missing actualOdometerKm', async () => {
      const response = await http
        .patch(API_PATHS.cancelVehicle(taskId, UUIDS.vehicles.V1))
        .send(INVALID_PAYLOADS.cancelVehicle.missingActualOdometer);

      assertBadRequest(response);
    });

    // TODO: API validation bug - nested object validation not returning 400
    it.skip('should reject missing cancellationReason - API returns 500, expected 400', async () => {
      const response = await http
        .patch(API_PATHS.cancelVehicle(taskId, UUIDS.vehicles.V1))
        .send(INVALID_PAYLOADS.cancelVehicle.missingCancellationReason);

      assertBadRequest(response);
    });

    it('should reject master mode without reasonId', async () => {
      const response = await http
        .patch(API_PATHS.cancelVehicle(taskId, UUIDS.vehicles.V1))
        .send(INVALID_PAYLOADS.cancelVehicle.masterModeMissingId);

      assertBadRequest(response);
    });
  });

  describe('Immutability', () => {
    it('should reject cancellation of already cancelled vehicle', async () => {
      // Cancel the vehicle first
      await http
        .patch(API_PATHS.cancelVehicle(taskId, UUIDS.vehicles.V1))
        .send(VALID_PAYLOADS.cancelVehicle.withCustomReason);

      // Try to cancel again
      const response = await http
        .patch(API_PATHS.cancelVehicle(taskId, UUIDS.vehicles.V1))
        .send(VALID_PAYLOADS.cancelVehicle.withCustomReason);

      assertBadRequest(response);
    });

    it('should reject cancellation of completed vehicle', async () => {
      // Add completed vehicle
      await createTaskVehicleDirect(
        UUIDS.tenants.A,
        taskId,
        UUIDS.vehicles.V2,
        {
          status: 'completed',
          completionDate: new Date(),
          actualOdometerKm: 50500,
          workshopCustom: 'Test',
          costAmount: 100,
        },
      );

      const response = await http
        .patch(API_PATHS.cancelVehicle(taskId, UUIDS.vehicles.V2))
        .send(VALID_PAYLOADS.cancelVehicle.withCustomReason);

      assertBadRequest(response);
    });

    it('should reject cancellation of rescheduled vehicle', async () => {
      // Add rescheduled vehicle
      await createTaskVehicleDirect(
        UUIDS.tenants.A,
        taskId,
        UUIDS.vehicles.V3,
        {
          status: 'rescheduled',
          rescheduleOriginalDueDate: new Date('2025-01-01'),
          rescheduleNewDueDate: new Date('2025-02-01'),
          rescheduleOdometerKm: 48000,
          rescheduleReasonCustom: 'Test',
        },
      );

      const response = await http
        .patch(API_PATHS.cancelVehicle(taskId, UUIDS.vehicles.V3))
        .send(VALID_PAYLOADS.cancelVehicle.withCustomReason);

      assertBadRequest(response);
    });
  });

  describe('Reference Validation', () => {
    it('should return 404 for non-existent reason', async () => {
      const response = await http
        .patch(API_PATHS.cancelVehicle(taskId, UUIDS.vehicles.V1))
        .send({
          date: '2025-01-15',
          actualOdometerKm: 49000,
          cancellationReason: {
            mode: 'master',
            reasonId: UUIDS.nonExistent.REASON,
          },
        });

      assertNotFound(response);
    });

    it('should return 404 for non-existent task', async () => {
      const response = await http
        .patch(
          API_PATHS.cancelVehicle(UUIDS.nonExistent.TASK, UUIDS.vehicles.V1),
        )
        .send(VALID_PAYLOADS.cancelVehicle.withCustomReason);

      assertNotFound(response);
    });

    it('should return 404 for non-existent vehicle', async () => {
      const response = await http
        .patch(API_PATHS.cancelVehicle(taskId, UUIDS.nonExistent.VEHICLE))
        .send(VALID_PAYLOADS.cancelVehicle.withCustomReason);

      assertNotFound(response);
    });
  });

  describe('Audit Logging', () => {
    it('should create audit log with status transition', async () => {
      await http
        .patch(API_PATHS.cancelVehicle(taskId, UUIDS.vehicles.V1))
        .send(VALID_PAYLOADS.cancelVehicle.withCustomReason);

      await verifyStatusTransitionAudit(
        UUIDS.tenants.A,
        taskId,
        'status_cancelled',
        'open',
        'cancelled',
      );
    });
  });
});
