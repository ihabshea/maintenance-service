import { INestApplication } from '@nestjs/common';
import { createTestApp, closeTestApp } from '../helpers/app.helper';
import { HttpClient, API_PATHS } from '../helpers/http.helper';
import {
  assertOk,
  assertNotFound,
  assertCreated,
} from '../helpers/assertions.helper';
import {
  cleanupTenant,
  createTaskDirect,
  createTaskVehicleDirect,
} from '../helpers/prisma.helper';
import { UUIDS } from '../fixtures/uuids';
import { VALID_PAYLOADS } from '../fixtures/payloads';

/**
 * Contract Tests: Cross-Tenant Data Isolation
 *
 * Source of Truth: tenancy-model.md
 *
 * Tests that verify data isolation between tenants.
 * Each tenant should only see their own data.
 */
describe('Cross-Tenant Data Isolation', () => {
  let app: INestApplication;
  let httpA: HttpClient;
  let httpB: HttpClient;
  let tenantATaskId: string;
  let tenantBTaskId: string;

  beforeAll(async () => {
    app = await createTestApp();
    httpA = new HttpClient(app, UUIDS.tenants.A);
    httpB = new HttpClient(app, UUIDS.tenants.B);
  });

  afterAll(async () => {
    await closeTestApp();
  });

  beforeEach(async () => {
    await cleanupTenant(UUIDS.tenants.A);
    await cleanupTenant(UUIDS.tenants.B);

    // Create task for tenant A
    const taskA = await createTaskDirect(UUIDS.tenants.A, {
      title: 'Tenant A Task',
      maintenanceType: 'preventive',
    });
    tenantATaskId = taskA.id;
    await createTaskVehicleDirect(
      UUIDS.tenants.A,
      tenantATaskId,
      UUIDS.vehicles.V1,
    );

    // Create task for tenant B
    const taskB = await createTaskDirect(UUIDS.tenants.B, {
      title: 'Tenant B Task',
      maintenanceType: 'corrective',
    });
    tenantBTaskId = taskB.id;
    await createTaskVehicleDirect(
      UUIDS.tenants.B,
      tenantBTaskId,
      UUIDS.vehicles.V1,
    );
  });

  describe('Task Access', () => {
    it('should allow tenant A to access their own task', async () => {
      const response = await httpA.get(API_PATHS.task(tenantATaskId));

      assertOk(response);
      expect(response.body.data.title).toBe('Tenant A Task');
    });

    it('should allow tenant B to access their own task', async () => {
      const response = await httpB.get(API_PATHS.task(tenantBTaskId));

      assertOk(response);
      expect(response.body.data.title).toBe('Tenant B Task');
    });

    it('should deny tenant A access to tenant B task', async () => {
      const response = await httpA.get(API_PATHS.task(tenantBTaskId));

      assertNotFound(response);
    });

    it('should deny tenant B access to tenant A task', async () => {
      const response = await httpB.get(API_PATHS.task(tenantATaskId));

      assertNotFound(response);
    });
  });

  describe('Vehicle Operations', () => {
    it('should deny tenant B from adding vehicles to tenant A task', async () => {
      const response = await httpB
        .post(API_PATHS.taskVehicles(tenantATaskId))
        .send({ vehicles: [{ vehicleId: UUIDS.vehicles.V2 }] });

      assertNotFound(response);
    });

    it('should deny tenant A from completing tenant B vehicle', async () => {
      const response = await httpA
        .patch(API_PATHS.completeVehicle(tenantBTaskId, UUIDS.vehicles.V1))
        .send(VALID_PAYLOADS.completeVehicle.minimal);

      assertNotFound(response);
    });

    it('should deny tenant B from cancelling tenant A vehicle', async () => {
      const response = await httpB
        .patch(API_PATHS.cancelVehicle(tenantATaskId, UUIDS.vehicles.V1))
        .send(VALID_PAYLOADS.cancelVehicle.withCustomReason);

      assertNotFound(response);
    });
  });

  describe('Vehicle Maintenance History', () => {
    it('should only return tenant A records for tenant A query', async () => {
      const response = await httpA.get(
        API_PATHS.vehicleMaintenance(UUIDS.vehicles.V1),
      );

      assertOk(response);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].task.title).toBe('Tenant A Task');
    });

    it('should only return tenant B records for tenant B query', async () => {
      const response = await httpB.get(
        API_PATHS.vehicleMaintenance(UUIDS.vehicles.V1),
      );

      assertOk(response);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].task.title).toBe('Tenant B Task');
    });
  });

  describe('Attachments', () => {
    it('should deny tenant B from creating attachment on tenant A vehicle', async () => {
      const response = await httpB
        .post(API_PATHS.attachments(tenantATaskId, UUIDS.vehicles.V1))
        .send(VALID_PAYLOADS.createAttachment.minimal);

      assertNotFound(response);
    });

    it('should deny tenant A from listing tenant B attachments', async () => {
      // Create attachment as tenant B
      await httpB
        .post(API_PATHS.attachments(tenantBTaskId, UUIDS.vehicles.V1))
        .send(VALID_PAYLOADS.createAttachment.minimal);

      // Try to list as tenant A
      const response = await httpA.get(
        API_PATHS.attachments(tenantBTaskId, UUIDS.vehicles.V1),
      );

      assertNotFound(response);
    });
  });

  describe('Corrections', () => {
    beforeEach(async () => {
      // Complete vehicles for correction tests
      await createTaskVehicleDirect(
        UUIDS.tenants.A,
        tenantATaskId,
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

    it('should deny tenant B from correcting tenant A completed vehicle', async () => {
      const response = await httpB
        .post(API_PATHS.corrections(tenantATaskId, UUIDS.vehicles.V2))
        .send(VALID_PAYLOADS.correction.costCorrection);

      assertNotFound(response);
    });
  });

  describe('Reference Data Visibility', () => {
    it('should allow both tenants to see system workshops', async () => {
      const responseA = await httpA.get(API_PATHS.workshops);
      const responseB = await httpB.get(API_PATHS.workshops);

      assertOk(responseA);
      assertOk(responseB);

      const systemWorkshopsA = responseA.body.data.filter(
        (w: any) => w.scope === 'system',
      );
      const systemWorkshopsB = responseB.body.data.filter(
        (w: any) => w.scope === 'system',
      );

      expect(systemWorkshopsA.length).toBeGreaterThan(0);
      expect(systemWorkshopsB.length).toBeGreaterThan(0);
      expect(systemWorkshopsA.length).toBe(systemWorkshopsB.length);
    });

    it('should allow both tenants to see system reasons', async () => {
      const responseA = await httpA.get(API_PATHS.reasons);
      const responseB = await httpB.get(API_PATHS.reasons);

      assertOk(responseA);
      assertOk(responseB);

      const systemReasonsA = responseA.body.data.filter(
        (r: any) => r.scope === 'system',
      );
      const systemReasonsB = responseB.body.data.filter(
        (r: any) => r.scope === 'system',
      );

      expect(systemReasonsA.length).toBeGreaterThan(0);
      expect(systemReasonsB.length).toBeGreaterThan(0);
      expect(systemReasonsA.length).toBe(systemReasonsB.length);
    });

    it('should isolate tenant-specific workshops', async () => {
      // Create workshop for tenant A
      await httpA
        .post(API_PATHS.workshops)
        .send({ name: 'Tenant A Private Workshop' });

      // Create workshop for tenant B
      await httpB
        .post(API_PATHS.workshops)
        .send({ name: 'Tenant B Private Workshop' });

      // Query as tenant A
      const responseA = await httpA.get(API_PATHS.workshops);
      const tenantWorkshopsA = responseA.body.data.filter(
        (w: any) => w.scope === 'tenant',
      );

      // Query as tenant B
      const responseB = await httpB.get(API_PATHS.workshops);
      const tenantWorkshopsB = responseB.body.data.filter(
        (w: any) => w.scope === 'tenant',
      );

      // Tenant A should not see Tenant B's workshop
      const aSeesB = tenantWorkshopsA.some(
        (w: any) => w.name === 'Tenant B Private Workshop',
      );
      expect(aSeesB).toBe(false);

      // Tenant B should not see Tenant A's workshop
      const bSeesA = tenantWorkshopsB.some(
        (w: any) => w.name === 'Tenant A Private Workshop',
      );
      expect(bSeesA).toBe(false);
    });
  });

  describe('Task Creation', () => {
    it('should create tasks with correct tenant isolation', async () => {
      const responseA = await httpA
        .post(API_PATHS.tasks)
        .send({ title: 'New A Task', maintenanceType: 'preventive' });

      const responseB = await httpB
        .post(API_PATHS.tasks)
        .send({ title: 'New B Task', maintenanceType: 'corrective' });

      assertCreated(responseA);
      assertCreated(responseB);

      expect(responseA.body.data.tenantId).toBe(UUIDS.tenants.A);
      expect(responseB.body.data.tenantId).toBe(UUIDS.tenants.B);
    });
  });
});
