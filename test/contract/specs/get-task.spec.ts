import { INestApplication } from '@nestjs/common';
import { createTestApp, closeTestApp } from '../helpers/app.helper';
import { HttpClient, API_PATHS, extractData } from '../helpers/http.helper';
import {
  assertOk,
  assertNotFound,
  assertTaskStructure,
  assertTaskHasVehicles,
  assertTaskHasJobs,
  assertOverdueFields,
} from '../helpers/assertions.helper';
import {
  cleanupTenant,
  createTaskDirect,
  createTaskVehicleDirect,
  createTaskJobDirect,
} from '../helpers/prisma.helper';
import { UUIDS } from '../fixtures/uuids';

/**
 * Contract Tests: GET /api/maintenance/tasks/:taskId
 *
 * Source of Truth: api-contract.md (Section 2), validation-rules.md
 *
 * Retrieves a task with its vehicles and jobs.
 */
describe('GET /api/maintenance/tasks/:taskId', () => {
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
    await cleanupTenant(UUIDS.tenants.B);

    // Create a test task
    const task = await createTaskDirect(UUIDS.tenants.A, {
      title: 'Get Task Test',
      maintenanceType: 'preventive',
      triggerMode: 'mileage',
      triggerKm: 5000,
    });
    taskId = task.id;
  });

  describe('Happy Path', () => {
    it('should return task with basic fields', async () => {
      const response = await http.get(API_PATHS.task(taskId));

      assertTaskStructure(response);
      expect(response.body.data.id).toBe(taskId);
      expect(response.body.data.title).toBe('Get Task Test');
      expect(response.body.data.maintenanceType).toBe('preventive');
    });

    it('should return task with vehicles', async () => {
      await createTaskVehicleDirect(UUIDS.tenants.A, taskId, UUIDS.vehicles.V1, {
        dueOdometerKm: 50000,
        dueDate: new Date('2025-06-01'),
      });

      const response = await http.get(API_PATHS.task(taskId));

      assertTaskHasVehicles(response, 1);
      const vehicle = response.body.data.vehicles[0];
      expect(vehicle.vehicleId).toBe(UUIDS.vehicles.V1);
      expect(vehicle.status).toBe('open');
      expect(vehicle.dueOdometerKm).toBe(50000);
    });

    it('should return task with jobs', async () => {
      await createTaskJobDirect(UUIDS.tenants.A, taskId, {
        jobCode: 'JOB001',
        label: 'Test Job',
        sortOrder: 1,
      });

      const response = await http.get(API_PATHS.task(taskId));

      assertTaskHasJobs(response, 1);
      const job = response.body.data.jobs[0];
      expect(job.jobCode).toBe('JOB001');
      expect(job.label).toBe('Test Job');
    });

    it('should return task with multiple vehicles and jobs', async () => {
      await createTaskVehicleDirect(UUIDS.tenants.A, taskId, UUIDS.vehicles.V1);
      await createTaskVehicleDirect(UUIDS.tenants.A, taskId, UUIDS.vehicles.V2);
      await createTaskJobDirect(UUIDS.tenants.A, taskId, {
        jobCode: 'JOB001',
        label: 'Job 1',
        sortOrder: 1,
      });
      await createTaskJobDirect(UUIDS.tenants.A, taskId, {
        jobCode: 'JOB002',
        label: 'Job 2',
        sortOrder: 2,
      });

      const response = await http.get(API_PATHS.task(taskId));

      assertTaskHasVehicles(response, 2);
      assertTaskHasJobs(response, 2);
    });
  });

  describe('Overdue Computation', () => {
    it('should compute overdue=true when dueDate is in the past for open preventive vehicle', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 7); // 7 days ago

      await createTaskVehicleDirect(UUIDS.tenants.A, taskId, UUIDS.vehicles.V1, {
        status: 'open',
        dueDate: pastDate,
      });

      const response = await http.get(API_PATHS.task(taskId));

      assertOk(response);
      const vehicle = response.body.data.vehicles[0];
      assertOverdueFields(vehicle, true, 'computed');
    });

    it('should compute overdue=false when dueDate is in the future for open preventive vehicle', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30); // 30 days from now

      await createTaskVehicleDirect(UUIDS.tenants.A, taskId, UUIDS.vehicles.V1, {
        status: 'open',
        dueDate: futureDate,
      });

      const response = await http.get(API_PATHS.task(taskId));

      assertOk(response);
      const vehicle = response.body.data.vehicles[0];
      assertOverdueFields(vehicle, false, 'computed');
    });

    it('should return insufficient_data when only dueOdometerKm is set', async () => {
      await createTaskVehicleDirect(UUIDS.tenants.A, taskId, UUIDS.vehicles.V1, {
        status: 'open',
        dueOdometerKm: 50000,
      });

      const response = await http.get(API_PATHS.task(taskId));

      assertOk(response);
      const vehicle = response.body.data.vehicles[0];
      assertOverdueFields(vehicle, null, 'insufficient_data');
    });

    it('should return not_applicable for completed vehicle', async () => {
      await createTaskVehicleDirect(UUIDS.tenants.A, taskId, UUIDS.vehicles.V1, {
        status: 'completed',
        dueDate: new Date('2025-01-01'),
        completionDate: new Date('2025-01-15'),
        actualOdometerKm: 50500,
        workshopCustom: 'Test Workshop',
        costAmount: 100,
      });

      const response = await http.get(API_PATHS.task(taskId));

      assertOk(response);
      const vehicle = response.body.data.vehicles[0];
      assertOverdueFields(vehicle, null, 'not_applicable');
    });

    it('should return not_applicable for corrective task', async () => {
      // Create corrective task
      const correctiveTask = await createTaskDirect(UUIDS.tenants.A, {
        title: 'Corrective Task',
        maintenanceType: 'corrective',
      });

      await createTaskVehicleDirect(
        UUIDS.tenants.A,
        correctiveTask.id,
        UUIDS.vehicles.V1,
        {
          status: 'open',
          dueDate: new Date('2025-01-01'), // Past date but corrective
        },
      );

      const response = await http.get(API_PATHS.task(correctiveTask.id));

      assertOk(response);
      const vehicle = response.body.data.vehicles[0];
      assertOverdueFields(vehicle, null, 'not_applicable');
    });
  });

  describe('Tenancy', () => {
    it('should return 404 for task belonging to different tenant', async () => {
      http.setTenantId(UUIDS.tenants.B);

      const response = await http.get(API_PATHS.task(taskId));

      assertNotFound(response);
    });

    it('should return task when tenant matches', async () => {
      http.setTenantId(UUIDS.tenants.A);

      const response = await http.get(API_PATHS.task(taskId));

      assertOk(response);
      expect(response.body.data.id).toBe(taskId);
    });
  });

  describe('Error Cases', () => {
    it('should return 404 for non-existent task', async () => {
      const response = await http.get(API_PATHS.task(UUIDS.nonExistent.TASK));

      assertNotFound(response);
    });
  });

  describe('Response Format', () => {
    it('should wrap response in data envelope', async () => {
      const response = await http.get(API_PATHS.task(taskId));

      assertOk(response);
      expect(response.body).toHaveProperty('data');
    });
  });
});
