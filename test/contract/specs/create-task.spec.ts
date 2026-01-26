import { INestApplication } from '@nestjs/common';
import { createTestApp, closeTestApp } from '../helpers/app.helper';
import { HttpClient, API_PATHS, extractData } from '../helpers/http.helper';
import {
  assertCreated,
  assertBadRequest,
  assertDataField,
  assertDataHasFields,
} from '../helpers/assertions.helper';
import { verifyCreateAudit } from '../helpers/audit.helper';
import { cleanupTenant } from '../helpers/prisma.helper';
import { UUIDS } from '../fixtures/uuids';
import { VALID_PAYLOADS, INVALID_PAYLOADS } from '../fixtures/payloads';

/**
 * Contract Tests: POST /api/maintenance/tasks
 *
 * Source of Truth: api-contract.md (Section 1), validation-rules.md
 *
 * Creates a new maintenance task with optional vehicles and checklist.
 */
describe('POST /api/maintenance/tasks', () => {
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
    await cleanupTenant(UUIDS.tenants.A);
  });

  describe('Happy Path', () => {
    it('should create preventive task with vehicles and checklist', async () => {
      const response = await http
        .post(API_PATHS.tasks)
        .send(VALID_PAYLOADS.createTask.preventiveWithVehicles);

      assertCreated(response);
      assertDataField(response, 'title', 'Contract Test - Oil Change');
      assertDataField(response, 'maintenanceType', 'preventive');
      assertDataField(response, 'triggerMode', 'mileage');
      assertDataField(response, 'triggerKm', 5000);
      assertDataField(response, 'tenantId', UUIDS.tenants.A);
      assertDataHasFields(response, ['id', 'createdAt', 'updatedAt']);
    });

    it('should create corrective task with minimal fields', async () => {
      const response = await http
        .post(API_PATHS.tasks)
        .send(VALID_PAYLOADS.createTask.correctiveMinimal);

      assertCreated(response);
      assertDataField(response, 'title', 'Contract Test - Emergency Repair');
      assertDataField(response, 'maintenanceType', 'corrective');
      assertDataField(response, 'tenantId', UUIDS.tenants.A);
    });

    it('should create preventive task with minimal fields', async () => {
      const response = await http
        .post(API_PATHS.tasks)
        .send(VALID_PAYLOADS.createTask.preventiveMinimal);

      assertCreated(response);
      assertDataField(response, 'maintenanceType', 'preventive');
    });

    it('should create task with selectionContext and sourceGroupId', async () => {
      const response = await http
        .post(API_PATHS.tasks)
        .send(VALID_PAYLOADS.createTask.withSelectionContext);

      assertCreated(response);
      const data = extractData<any>(response);
      expect(data.selectionContext).toEqual({
        fleetId: 'fleet-123',
        region: 'MENA',
      });
      expect(data.sourceGroupId).toBe(UUIDS.tasks.TASK_1);
    });

    it('should set createdBy from X-Actor header', async () => {
      http.setActor('test-actor@example.com');
      const response = await http
        .post(API_PATHS.tasks)
        .send(VALID_PAYLOADS.createTask.correctiveMinimal);

      assertCreated(response);
      assertDataField(response, 'createdBy', 'test-actor@example.com');
    });
  });

  describe('Validation Errors', () => {
    it('should reject request with missing title', async () => {
      const response = await http
        .post(API_PATHS.tasks)
        .send(INVALID_PAYLOADS.createTask.missingTitle);

      assertBadRequest(response);
    });

    it('should reject request with missing maintenanceType', async () => {
      const response = await http
        .post(API_PATHS.tasks)
        .send(INVALID_PAYLOADS.createTask.missingMaintenanceType);

      assertBadRequest(response);
    });

    it('should reject request with invalid maintenanceType enum', async () => {
      const response = await http
        .post(API_PATHS.tasks)
        .send(INVALID_PAYLOADS.createTask.invalidMaintenanceType);

      assertBadRequest(response);
    });

    it('should reject request with negative triggerKm', async () => {
      const response = await http
        .post(API_PATHS.tasks)
        .send(INVALID_PAYLOADS.createTask.negativeTriggerKm);

      assertBadRequest(response);
    });

    it('should reject request with non-whitelisted fields', async () => {
      const response = await http
        .post(API_PATHS.tasks)
        .send(INVALID_PAYLOADS.createTask.nonWhitelisted);

      assertBadRequest(response);
    });

    it('should reject request with invalid vehicleId format', async () => {
      const response = await http
        .post(API_PATHS.tasks)
        .send(INVALID_PAYLOADS.createTask.invalidVehicleId);

      assertBadRequest(response);
    });
  });

  describe('Tenancy', () => {
    it('should create task with correct tenantId from header', async () => {
      http.setTenantId(UUIDS.tenants.B);
      const response = await http
        .post(API_PATHS.tasks)
        .send(VALID_PAYLOADS.createTask.correctiveMinimal);

      assertCreated(response);
      assertDataField(response, 'tenantId', UUIDS.tenants.B);
    });
  });

  describe('Audit Logging', () => {
    // TODO: Audit logging not yet implemented for task creation
    it.skip('should create audit log entry with action=create - audit logging not yet implemented', async () => {
      const response = await http
        .post(API_PATHS.tasks)
        .send(VALID_PAYLOADS.createTask.correctiveMinimal);

      assertCreated(response);
      const data = extractData<{ id: string }>(response);

      await verifyCreateAudit(
        UUIDS.tenants.A,
        'task',
        data.id,
        'contract-test',
      );
    });
  });

  describe('Response Format', () => {
    it('should wrap response in data envelope', async () => {
      const response = await http
        .post(API_PATHS.tasks)
        .send(VALID_PAYLOADS.createTask.correctiveMinimal);

      expect(response.body).toHaveProperty('data');
      expect(typeof response.body.data).toBe('object');
    });

    it('should return ISO timestamps for date fields', async () => {
      const response = await http
        .post(API_PATHS.tasks)
        .send(VALID_PAYLOADS.createTask.correctiveMinimal);

      assertCreated(response);
      const data = extractData<{ createdAt: string; updatedAt: string }>(
        response,
      );

      // Check ISO 8601 format
      expect(Date.parse(data.createdAt)).not.toBeNaN();
      expect(Date.parse(data.updatedAt)).not.toBeNaN();
    });
  });
});
