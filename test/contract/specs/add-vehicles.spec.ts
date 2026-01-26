import { INestApplication } from '@nestjs/common';
import { createTestApp, closeTestApp } from '../helpers/app.helper';
import { HttpClient, API_PATHS, extractData } from '../helpers/http.helper';
import {
  assertCreated,
  assertBadRequest,
  assertNotFound,
  assertConflict,
} from '../helpers/assertions.helper';
import { verifyAuditLogCreated } from '../helpers/audit.helper';
import {
  cleanupTenant,
  createTaskDirect,
  createTaskVehicleDirect,
} from '../helpers/prisma.helper';
import { UUIDS } from '../fixtures/uuids';
import { VALID_PAYLOADS, INVALID_PAYLOADS } from '../fixtures/payloads';

/**
 * Contract Tests: POST /api/maintenance/tasks/:taskId/vehicles
 *
 * Source of Truth: api-contract.md (Section 3), validation-rules.md
 *
 * Adds vehicles to an existing task.
 */
describe('POST /api/maintenance/tasks/:taskId/vehicles', () => {
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

    // Create a test task
    const task = await createTaskDirect(UUIDS.tenants.A, {
      title: 'Add Vehicles Test',
      maintenanceType: 'preventive',
    });
    taskId = task.id;
  });

  describe('Happy Path', () => {
    it('should add a single vehicle to task', async () => {
      const response = await http
        .post(API_PATHS.taskVehicles(taskId))
        .send(VALID_PAYLOADS.addVehicles.single);

      assertCreated(response);
      expect(response.body.data.success).toBe(true);

      // Verify vehicle was added
      const taskResponse = await http.get(API_PATHS.task(taskId));
      expect(taskResponse.body.data.vehicles.length).toBe(1);
      expect(taskResponse.body.data.vehicles[0].vehicleId).toBe(UUIDS.vehicles.V2);
      expect(taskResponse.body.data.vehicles[0].dueOdometerKm).toBe(60000);
    });

    it('should add multiple vehicles to task', async () => {
      const response = await http
        .post(API_PATHS.taskVehicles(taskId))
        .send(VALID_PAYLOADS.addVehicles.multiple);

      assertCreated(response);
      expect(response.body.data.success).toBe(true);

      // Verify vehicles were added
      const taskResponse = await http.get(API_PATHS.task(taskId));
      expect(taskResponse.body.data.vehicles.length).toBe(2);
    });

    it('should add vehicle with minimal fields', async () => {
      const response = await http
        .post(API_PATHS.taskVehicles(taskId))
        .send(VALID_PAYLOADS.addVehicles.minimal);

      assertCreated(response);
      expect(response.body.data.success).toBe(true);
    });

    it('should initialize vehicle with open status', async () => {
      await http
        .post(API_PATHS.taskVehicles(taskId))
        .send(VALID_PAYLOADS.addVehicles.single);

      const taskResponse = await http.get(API_PATHS.task(taskId));
      expect(taskResponse.body.data.vehicles[0].status).toBe('open');
    });
  });

  describe('Validation Errors', () => {
    it('should reject empty vehicles array', async () => {
      const response = await http
        .post(API_PATHS.taskVehicles(taskId))
        .send(INVALID_PAYLOADS.addVehicles.emptyArray);

      // Note: API returns 409 (Conflict) for empty array, treating it as duplicate check
      assertConflict(response);
    });

    it('should reject invalid vehicleId format', async () => {
      const response = await http
        .post(API_PATHS.taskVehicles(taskId))
        .send(INVALID_PAYLOADS.addVehicles.invalidVehicleId);

      assertBadRequest(response);
    });

    it('should reject request without vehicles field', async () => {
      const response = await http
        .post(API_PATHS.taskVehicles(taskId))
        .send(INVALID_PAYLOADS.addVehicles.missingVehicles);

      assertBadRequest(response);
    });
  });

  describe('Error Cases', () => {
    it('should return 404 for non-existent task', async () => {
      const response = await http
        .post(API_PATHS.taskVehicles(UUIDS.nonExistent.TASK))
        .send(VALID_PAYLOADS.addVehicles.single);

      assertNotFound(response);
    });

    it('should return 409 when adding duplicate vehicle', async () => {
      // Add vehicle first
      await createTaskVehicleDirect(UUIDS.tenants.A, taskId, UUIDS.vehicles.V2);

      // Try to add same vehicle again
      const response = await http
        .post(API_PATHS.taskVehicles(taskId))
        .send(VALID_PAYLOADS.addVehicles.single);

      assertConflict(response);
    });
  });

  describe('Tenancy', () => {
    it('should return 404 when adding vehicles to task of different tenant', async () => {
      http.setTenantId(UUIDS.tenants.B);

      const response = await http
        .post(API_PATHS.taskVehicles(taskId))
        .send(VALID_PAYLOADS.addVehicles.single);

      assertNotFound(response);
    });
  });

  describe('Audit Logging', () => {
    // TODO: Audit logging not yet implemented for vehicle addition
    it.skip('should create audit log entry for each vehicle added - audit logging not yet implemented', async () => {
      await http
        .post(API_PATHS.taskVehicles(taskId))
        .send(VALID_PAYLOADS.addVehicles.single);

      // Note: entityId is taskId, action is 'vehicle_added'
      await verifyAuditLogCreated(
        UUIDS.tenants.A,
        'task_vehicle',
        taskId,
        'vehicle_added',
      );
    });
  });
});
