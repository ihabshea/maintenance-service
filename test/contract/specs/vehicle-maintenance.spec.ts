import { INestApplication } from '@nestjs/common';
import { createTestApp, closeTestApp } from '../helpers/app.helper';
import { HttpClient, API_PATHS } from '../helpers/http.helper';
import {
  assertOk,
  assertBadRequest,
  assertDataIsArray,
} from '../helpers/assertions.helper';
import {
  cleanupTenant,
  createTaskDirect,
  createTaskVehicleDirect,
} from '../helpers/prisma.helper';
import { UUIDS } from '../fixtures/uuids';

/**
 * Contract Tests: GET /api/vehicles/:vehicleId/maintenance
 *
 * Source of Truth: api-contract.md (Section 4)
 *
 * Retrieves maintenance history for a vehicle.
 */
describe('GET /api/vehicles/:vehicleId/maintenance', () => {
  let app: INestApplication;
  let http: HttpClient;

  beforeAll(async () => {
    app = await createTestApp();
    http = new HttpClient(app, UUIDS.tenants.A);
  });

  afterAll(async () => {
    await closeTestApp();
  });

  beforeEach(async () => {
    // Reset tenant ID to tenant A at the start of each test
    http.setTenantId(UUIDS.tenants.A);

    await cleanupTenant(UUIDS.tenants.A);
    await cleanupTenant(UUIDS.tenants.B);
  });

  describe('Happy Path', () => {
    it('should return empty array when vehicle has no maintenance', async () => {
      const response = await http.get(
        API_PATHS.vehicleMaintenance(UUIDS.vehicles.V1),
      );

      assertOk(response);
      assertDataIsArray(response);
      expect(response.body.data.length).toBe(0);
    });

    it('should return maintenance records for vehicle', async () => {
      // Create task and add vehicle
      const task = await createTaskDirect(UUIDS.tenants.A, {
        title: 'Oil Change',
        maintenanceType: 'preventive',
      });
      await createTaskVehicleDirect(
        UUIDS.tenants.A,
        task.id,
        UUIDS.vehicles.V1,
        {
          status: 'open',
          dueOdometerKm: 50000,
        },
      );

      const response = await http.get(
        API_PATHS.vehicleMaintenance(UUIDS.vehicles.V1),
      );

      assertOk(response);
      assertDataIsArray(response);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].taskId).toBe(task.id);
      expect(response.body.data[0].task.title).toBe('Oil Change');
      expect(response.body.data[0].task.maintenanceType).toBe('preventive');
    });

    it('should return multiple maintenance records', async () => {
      // Create multiple tasks for same vehicle
      const task1 = await createTaskDirect(UUIDS.tenants.A, {
        title: 'Oil Change',
        maintenanceType: 'preventive',
      });
      const task2 = await createTaskDirect(UUIDS.tenants.A, {
        title: 'Brake Check',
        maintenanceType: 'corrective',
      });

      await createTaskVehicleDirect(
        UUIDS.tenants.A,
        task1.id,
        UUIDS.vehicles.V1,
      );
      await createTaskVehicleDirect(
        UUIDS.tenants.A,
        task2.id,
        UUIDS.vehicles.V1,
      );

      const response = await http.get(
        API_PATHS.vehicleMaintenance(UUIDS.vehicles.V1),
      );

      assertOk(response);
      expect(response.body.data.length).toBe(2);
    });
  });

  describe('Filtering', () => {
    beforeEach(async () => {
      // Create tasks with different types and statuses
      const preventiveTask = await createTaskDirect(UUIDS.tenants.A, {
        title: 'Preventive Task',
        maintenanceType: 'preventive',
      });
      const correctiveTask = await createTaskDirect(UUIDS.tenants.A, {
        title: 'Corrective Task',
        maintenanceType: 'corrective',
      });

      await createTaskVehicleDirect(
        UUIDS.tenants.A,
        preventiveTask.id,
        UUIDS.vehicles.V1,
        { status: 'open' },
      );
      await createTaskVehicleDirect(
        UUIDS.tenants.A,
        correctiveTask.id,
        UUIDS.vehicles.V1,
        {
          status: 'completed',
          completionDate: new Date(),
          actualOdometerKm: 50000,
          workshopCustom: 'Test',
          costAmount: 100,
        },
      );
    });

    it('should filter by maintenanceType=preventive', async () => {
      const response = await http
        .get(API_PATHS.vehicleMaintenance(UUIDS.vehicles.V1))
        .query({ maintenanceType: 'preventive' });

      assertOk(response);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].task.maintenanceType).toBe('preventive');
    });

    it('should filter by maintenanceType=corrective', async () => {
      const response = await http
        .get(API_PATHS.vehicleMaintenance(UUIDS.vehicles.V1))
        .query({ maintenanceType: 'corrective' });

      assertOk(response);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].task.maintenanceType).toBe('corrective');
    });

    it('should filter by status=open', async () => {
      const response = await http
        .get(API_PATHS.vehicleMaintenance(UUIDS.vehicles.V1))
        .query({ status: 'open' });

      assertOk(response);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].status).toBe('open');
    });

    it('should filter by status=completed', async () => {
      const response = await http
        .get(API_PATHS.vehicleMaintenance(UUIDS.vehicles.V1))
        .query({ status: 'completed' });

      assertOk(response);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].status).toBe('completed');
    });

    it('should combine maintenanceType and status filters', async () => {
      const response = await http
        .get(API_PATHS.vehicleMaintenance(UUIDS.vehicles.V1))
        .query({ maintenanceType: 'preventive', status: 'open' });

      assertOk(response);
      expect(response.body.data.length).toBe(1);
    });
  });

  describe('Validation Errors', () => {
    it('should reject invalid maintenanceType enum', async () => {
      const response = await http
        .get(API_PATHS.vehicleMaintenance(UUIDS.vehicles.V1))
        .query({ maintenanceType: 'invalid' });

      assertBadRequest(response);
    });

    it('should reject invalid status enum', async () => {
      const response = await http
        .get(API_PATHS.vehicleMaintenance(UUIDS.vehicles.V1))
        .query({ status: 'invalid' });

      assertBadRequest(response);
    });
  });

  describe('Tenancy', () => {
    it('should only return records for the requesting tenant', async () => {
      // Create task for tenant A
      const taskA = await createTaskDirect(UUIDS.tenants.A, {
        title: 'Tenant A Task',
        maintenanceType: 'preventive',
      });
      await createTaskVehicleDirect(
        UUIDS.tenants.A,
        taskA.id,
        UUIDS.vehicles.V1,
      );

      // Create task for tenant B with same vehicle ID
      const taskB = await createTaskDirect(UUIDS.tenants.B, {
        title: 'Tenant B Task',
        maintenanceType: 'corrective',
      });
      await createTaskVehicleDirect(
        UUIDS.tenants.B,
        taskB.id,
        UUIDS.vehicles.V1,
      );

      // Query as tenant A
      http.setTenantId(UUIDS.tenants.A);
      const responseA = await http.get(
        API_PATHS.vehicleMaintenance(UUIDS.vehicles.V1),
      );

      assertOk(responseA);
      expect(responseA.body.data.length).toBe(1);
      expect(responseA.body.data[0].task.title).toBe('Tenant A Task');

      // Query as tenant B
      http.setTenantId(UUIDS.tenants.B);
      const responseB = await http.get(
        API_PATHS.vehicleMaintenance(UUIDS.vehicles.V1),
      );

      assertOk(responseB);
      expect(responseB.body.data.length).toBe(1);
      expect(responseB.body.data[0].task.title).toBe('Tenant B Task');
    });
  });

  describe('Response Format', () => {
    it('should return records with expected fields', async () => {
      const task = await createTaskDirect(UUIDS.tenants.A, {
        title: 'Test Task',
        maintenanceType: 'preventive',
      });
      await createTaskVehicleDirect(
        UUIDS.tenants.A,
        task.id,
        UUIDS.vehicles.V1,
        {
          dueOdometerKm: 50000,
          dueDate: new Date('2025-06-01'),
        },
      );

      const response = await http.get(
        API_PATHS.vehicleMaintenance(UUIDS.vehicles.V1),
      );

      assertOk(response);
      const record = response.body.data[0];
      expect(record).toHaveProperty('taskId');
      expect(record).toHaveProperty('task.title');
      expect(record).toHaveProperty('task.maintenanceType');
      expect(record).toHaveProperty('vehicleId');
      expect(record).toHaveProperty('status');
    });
  });
});
