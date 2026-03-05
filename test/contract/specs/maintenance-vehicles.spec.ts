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
 * Contract Tests: GET /api/maintenance/vehicles
 *
 * Lists all vehicles with maintenance tasks across the tenant,
 * with optional active/status/maintenanceType filters and cursor pagination.
 */
describe('GET /api/maintenance/vehicles', () => {
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
    http.setTenantId(UUIDS.tenants.A);
    await cleanupTenant(UUIDS.tenants.A);
    await cleanupTenant(UUIDS.tenants.B);
  });

  describe('Happy Path', () => {
    it('should return empty result when no maintenance records exist', async () => {
      const response = await http.get(API_PATHS.maintenanceVehicles);

      assertOk(response);
      assertDataIsArray(response);
      expect(response.body.data.length).toBe(0);
      expect(response.body.pagination.hasMore).toBe(false);
      expect(response.body.pagination.nextCursor).toBeNull();
    });

    it('should return records across multiple vehicles', async () => {
      const task1 = await createTaskDirect(UUIDS.tenants.A, {
        title: 'Oil Change',
        maintenanceType: 'preventive',
      });
      const task2 = await createTaskDirect(UUIDS.tenants.A, {
        title: 'Brake Fix',
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
        UUIDS.vehicles.V2,
      );

      const response = await http.get(API_PATHS.maintenanceVehicles);

      assertOk(response);
      assertDataIsArray(response);
      expect(response.body.data.length).toBe(2);

      const vehicleIds = response.body.data.map(
        (r: any) => r.vehicleId,
      );
      expect(vehicleIds).toContain(UUIDS.vehicles.V1);
      expect(vehicleIds).toContain(UUIDS.vehicles.V2);
    });

    it('should include task details in each record', async () => {
      const task = await createTaskDirect(UUIDS.tenants.A, {
        title: 'Test Task',
        maintenanceType: 'preventive',
      });
      await createTaskVehicleDirect(
        UUIDS.tenants.A,
        task.id,
        UUIDS.vehicles.V1,
        { dueOdometerKm: 50000 },
      );

      const response = await http.get(API_PATHS.maintenanceVehicles);

      assertOk(response);
      const record = response.body.data[0];
      expect(record).toHaveProperty('taskId');
      expect(record).toHaveProperty('vehicleId');
      expect(record).toHaveProperty('status');
      expect(record).toHaveProperty('task.title');
      expect(record).toHaveProperty('task.maintenanceType');
      expect(record).toHaveProperty('overdue');
      expect(record).toHaveProperty('overdueComputation');
    });
  });

  describe('Active Filter', () => {
    beforeEach(async () => {
      // V1: has an open task (active)
      const openTask = await createTaskDirect(UUIDS.tenants.A, {
        title: 'Open Task',
        maintenanceType: 'preventive',
      });
      await createTaskVehicleDirect(
        UUIDS.tenants.A,
        openTask.id,
        UUIDS.vehicles.V1,
        { status: 'open' },
      );

      // V2: only completed tasks (non-active)
      const completedTask = await createTaskDirect(UUIDS.tenants.A, {
        title: 'Completed Task',
        maintenanceType: 'corrective',
      });
      await createTaskVehicleDirect(
        UUIDS.tenants.A,
        completedTask.id,
        UUIDS.vehicles.V2,
        {
          status: 'completed',
          completionDate: new Date(),
          actualOdometerKm: 50000,
          workshopCustom: 'Test',
          costAmount: 100,
        },
      );
    });

    it('should return only active vehicles when active=true', async () => {
      const response = await http
        .get(API_PATHS.maintenanceVehicles)
        .query({ active: 'true' });

      assertOk(response);
      assertDataIsArray(response);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].vehicleId).toBe(UUIDS.vehicles.V1);
    });

    it('should return only non-active vehicles when active=false', async () => {
      const response = await http
        .get(API_PATHS.maintenanceVehicles)
        .query({ active: 'false' });

      assertOk(response);
      assertDataIsArray(response);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].vehicleId).toBe(UUIDS.vehicles.V2);
    });

    it('should return all vehicles when active is not specified', async () => {
      const response = await http.get(API_PATHS.maintenanceVehicles);

      assertOk(response);
      expect(response.body.data.length).toBe(2);
    });
  });

  describe('Filtering', () => {
    beforeEach(async () => {
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
        UUIDS.vehicles.V2,
        {
          status: 'completed',
          completionDate: new Date(),
          actualOdometerKm: 50000,
          workshopCustom: 'Test',
          costAmount: 100,
        },
      );
    });

    it('should filter by status=open', async () => {
      const response = await http
        .get(API_PATHS.maintenanceVehicles)
        .query({ status: 'open' });

      assertOk(response);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].status).toBe('open');
    });

    it('should filter by status=completed', async () => {
      const response = await http
        .get(API_PATHS.maintenanceVehicles)
        .query({ status: 'completed' });

      assertOk(response);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].status).toBe('completed');
    });

    it('should filter by maintenanceType=preventive', async () => {
      const response = await http
        .get(API_PATHS.maintenanceVehicles)
        .query({ maintenanceType: 'preventive' });

      assertOk(response);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].task.maintenanceType).toBe('preventive');
    });

    it('should filter by maintenanceType=corrective', async () => {
      const response = await http
        .get(API_PATHS.maintenanceVehicles)
        .query({ maintenanceType: 'corrective' });

      assertOk(response);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].task.maintenanceType).toBe('corrective');
    });

    it('should combine status and maintenanceType filters', async () => {
      const response = await http
        .get(API_PATHS.maintenanceVehicles)
        .query({ status: 'open', maintenanceType: 'preventive' });

      assertOk(response);
      expect(response.body.data.length).toBe(1);
    });

    it('should reject invalid status enum', async () => {
      const response = await http
        .get(API_PATHS.maintenanceVehicles)
        .query({ status: 'invalid' });

      assertBadRequest(response);
    });

    it('should reject invalid maintenanceType enum', async () => {
      const response = await http
        .get(API_PATHS.maintenanceVehicles)
        .query({ maintenanceType: 'invalid' });

      assertBadRequest(response);
    });
  });

  describe('Pagination', () => {
    beforeEach(async () => {
      // Create 3 tasks, each with a different vehicle
      for (let i = 0; i < 3; i++) {
        const task = await createTaskDirect(UUIDS.tenants.A, {
          title: `Task ${i}`,
          maintenanceType: 'preventive',
        });
        await createTaskVehicleDirect(
          UUIDS.tenants.A,
          task.id,
          UUIDS.vehicles.V1 + i, // V1=1001, V2=1002, V3=1003
        );
      }
    });

    it('should respect limit parameter', async () => {
      const response = await http
        .get(API_PATHS.maintenanceVehicles)
        .query({ limit: 2 });

      assertOk(response);
      expect(response.body.data.length).toBe(2);
      expect(response.body.pagination.hasMore).toBe(true);
      expect(response.body.pagination.nextCursor).toBeTruthy();
    });

    it('should paginate with cursor', async () => {
      // First page
      const page1 = await http
        .get(API_PATHS.maintenanceVehicles)
        .query({ limit: 2 });

      assertOk(page1);
      expect(page1.body.data.length).toBe(2);
      expect(page1.body.pagination.hasMore).toBe(true);

      // Second page
      const page2 = await http
        .get(API_PATHS.maintenanceVehicles)
        .query({ limit: 2, cursor: page1.body.pagination.nextCursor });

      assertOk(page2);
      expect(page2.body.data.length).toBe(1);
      expect(page2.body.pagination.hasMore).toBe(false);

      // No overlap between pages
      const page1Ids = page1.body.data.map((r: any) => r.id);
      const page2Ids = page2.body.data.map((r: any) => r.id);
      for (const id of page2Ids) {
        expect(page1Ids).not.toContain(id);
      }
    });

    it('should return hasMore=false when all results fit', async () => {
      const response = await http
        .get(API_PATHS.maintenanceVehicles)
        .query({ limit: 100 });

      assertOk(response);
      expect(response.body.data.length).toBe(3);
      expect(response.body.pagination.hasMore).toBe(false);
      expect(response.body.pagination.nextCursor).toBeNull();
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
      const responseA = await http.get(API_PATHS.maintenanceVehicles);

      assertOk(responseA);
      expect(responseA.body.data.length).toBe(1);
      expect(responseA.body.data[0].task.title).toBe('Tenant A Task');

      // Query as tenant B
      http.setTenantId(UUIDS.tenants.B);
      const responseB = await http.get(API_PATHS.maintenanceVehicles);

      assertOk(responseB);
      expect(responseB.body.data.length).toBe(1);
      expect(responseB.body.data[0].task.title).toBe('Tenant B Task');
    });
  });
});
