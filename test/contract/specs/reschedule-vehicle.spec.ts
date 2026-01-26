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
  getPrisma,
} from '../helpers/prisma.helper';
import { UUIDS } from '../fixtures/uuids';
import { VALID_PAYLOADS, INVALID_PAYLOADS } from '../fixtures/payloads';

/**
 * Contract Tests: PATCH /api/maintenance/tasks/:taskId/vehicles/:vehicleId/status/rescheduled
 *
 * Source of Truth: api-contract.md (Section 7), validation-rules.md, audit-and-immutability.md
 *
 * Reschedules a vehicle execution.
 */
describe('PATCH .../status/rescheduled', () => {
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
      title: 'Reschedule Vehicle Test',
      maintenanceType: 'preventive',
    });
    taskId = task.id;

    await createTaskVehicleDirect(UUIDS.tenants.A, taskId, UUIDS.vehicles.V1, {
      status: 'open',
      dueOdometerKm: 50000,
      dueDate: new Date('2025-01-15'),
    });
  });

  describe('Happy Path', () => {
    it('should reschedule open vehicle', async () => {
      const response = await http
        .patch(API_PATHS.rescheduleVehicle(taskId, UUIDS.vehicles.V1))
        .send(VALID_PAYLOADS.rescheduleVehicle.standard);

      assertOk(response);
      expect(response.body.data.success).toBe(true);

      // Verify database state
      const prisma = getPrisma();
      const vehicle = await prisma.maintenanceTaskVehicle.findUnique({
        where: {
          tenantId_taskId_vehicleId: {
            tenantId: UUIDS.tenants.A,
            taskId,
            vehicleId: UUIDS.vehicles.V1,
          },
        },
      });

      expect(vehicle?.status).toBe('rescheduled');
      expect(vehicle?.rescheduleOdometerKm).toBe(48000);
      expect(vehicle?.rescheduleReason).toBe('Parts not available');
    });
  });

  describe('Validation Errors', () => {
    it('should reject missing originalDate', async () => {
      const response = await http
        .patch(API_PATHS.rescheduleVehicle(taskId, UUIDS.vehicles.V1))
        .send(INVALID_PAYLOADS.rescheduleVehicle.missingOriginalDate);

      assertBadRequest(response);
    });

    it('should reject missing newScheduledDate', async () => {
      const response = await http
        .patch(API_PATHS.rescheduleVehicle(taskId, UUIDS.vehicles.V1))
        .send(INVALID_PAYLOADS.rescheduleVehicle.missingNewScheduledDate);

      assertBadRequest(response);
    });

    it('should reject missing rescheduleOdometerKm', async () => {
      const response = await http
        .patch(API_PATHS.rescheduleVehicle(taskId, UUIDS.vehicles.V1))
        .send(INVALID_PAYLOADS.rescheduleVehicle.missingOdometer);

      assertBadRequest(response);
    });

    it('should reject missing reason', async () => {
      const response = await http
        .patch(API_PATHS.rescheduleVehicle(taskId, UUIDS.vehicles.V1))
        .send(INVALID_PAYLOADS.rescheduleVehicle.missingReason);

      assertBadRequest(response);
    });
  });

  describe('Immutability', () => {
    it('should reject rescheduling of already rescheduled vehicle', async () => {
      // Reschedule the vehicle first
      await http
        .patch(API_PATHS.rescheduleVehicle(taskId, UUIDS.vehicles.V1))
        .send(VALID_PAYLOADS.rescheduleVehicle.standard);

      // Try to reschedule again
      const response = await http
        .patch(API_PATHS.rescheduleVehicle(taskId, UUIDS.vehicles.V1))
        .send(VALID_PAYLOADS.rescheduleVehicle.standard);

      assertBadRequest(response);
    });

    it('should reject rescheduling of completed vehicle', async () => {
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
        .patch(API_PATHS.rescheduleVehicle(taskId, UUIDS.vehicles.V2))
        .send(VALID_PAYLOADS.rescheduleVehicle.standard);

      assertBadRequest(response);
    });

    it('should reject rescheduling of cancelled vehicle', async () => {
      // Add cancelled vehicle
      await createTaskVehicleDirect(
        UUIDS.tenants.A,
        taskId,
        UUIDS.vehicles.V3,
        {
          status: 'cancelled',
          cancellationDate: new Date(),
          actualOdometerKm: 49000,
          cancellationReasonCustom: 'Test',
        },
      );

      const response = await http
        .patch(API_PATHS.rescheduleVehicle(taskId, UUIDS.vehicles.V3))
        .send(VALID_PAYLOADS.rescheduleVehicle.standard);

      assertBadRequest(response);
    });
  });

  describe('Error Cases', () => {
    it('should return 404 for non-existent task', async () => {
      const response = await http
        .patch(
          API_PATHS.rescheduleVehicle(
            UUIDS.nonExistent.TASK,
            UUIDS.vehicles.V1,
          ),
        )
        .send(VALID_PAYLOADS.rescheduleVehicle.standard);

      assertNotFound(response);
    });

    it('should return 404 for non-existent vehicle', async () => {
      const response = await http
        .patch(API_PATHS.rescheduleVehicle(taskId, UUIDS.nonExistent.VEHICLE))
        .send(VALID_PAYLOADS.rescheduleVehicle.standard);

      assertNotFound(response);
    });
  });

  describe('Audit Logging', () => {
    it('should create audit log with status transition', async () => {
      await http
        .patch(API_PATHS.rescheduleVehicle(taskId, UUIDS.vehicles.V1))
        .send(VALID_PAYLOADS.rescheduleVehicle.standard);

      await verifyStatusTransitionAudit(
        UUIDS.tenants.A,
        taskId,
        'status_rescheduled',
        'open',
        'rescheduled',
      );
    });
  });
});
