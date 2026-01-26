import { INestApplication } from '@nestjs/common';
import { createTestApp, closeTestApp } from '../helpers/app.helper';
import { HttpClient, API_PATHS, extractData } from '../helpers/http.helper';
import {
  assertOk,
  assertCreated,
  assertBadRequest,
  assertNotFound,
  assertDataIsArray,
  assertAttachmentStructure,
} from '../helpers/assertions.helper';
import { verifyCreateAudit } from '../helpers/audit.helper';
import {
  cleanupTenant,
  createTaskDirect,
  createTaskVehicleDirect,
} from '../helpers/prisma.helper';
import { UUIDS } from '../fixtures/uuids';
import { VALID_PAYLOADS, INVALID_PAYLOADS } from '../fixtures/payloads';

/**
 * Contract Tests: POST/GET /api/maintenance/tasks/:taskId/vehicles/:vehicleId/attachments
 *
 * Source of Truth: api-contract.md (Sections 9, 10), tenancy-model.md
 *
 * Attachment metadata management for vehicle maintenance records.
 */
describe('Attachments', () => {
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
    // Reset tenant ID to tenant A at the start of each test
    http.setTenantId(UUIDS.tenants.A);

    await cleanupTenant(UUIDS.tenants.A);
    await cleanupTenant(UUIDS.tenants.B);

    // Create a test task with vehicle
    const task = await createTaskDirect(UUIDS.tenants.A, {
      title: 'Attachments Test',
      maintenanceType: 'corrective',
    });
    taskId = task.id;

    await createTaskVehicleDirect(UUIDS.tenants.A, taskId, UUIDS.vehicles.V1);
  });

  describe('POST /api/maintenance/tasks/:taskId/vehicles/:vehicleId/attachments', () => {
    describe('Happy Path', () => {
      it('should create attachment with all fields', async () => {
        const response = await http
          .post(API_PATHS.attachments(taskId, UUIDS.vehicles.V1))
          .send(VALID_PAYLOADS.createAttachment.receipt);

        assertCreated(response);
        const data = extractData<any>(response);

        expect(data.fileUrl).toBe(
          'https://storage.example.com/receipts/invoice.pdf',
        );
        expect(data.fileType).toBe('receipt');
        expect(data.fileName).toBe('invoice.pdf');
        expect(data.contentType).toBe('application/pdf');
        assertAttachmentStructure(data);
      });

      it('should create attachment with required fields only', async () => {
        const response = await http
          .post(API_PATHS.attachments(taskId, UUIDS.vehicles.V1))
          .send(VALID_PAYLOADS.createAttachment.minimal);

        assertCreated(response);
        const data = extractData<any>(response);

        expect(data.fileUrl).toBe('https://storage.example.com/docs/file.pdf');
        expect(data.fileType).toBe('document');
      });

      it('should set uploadedBy from X-Actor header', async () => {
        http.setActor('uploader@example.com');
        const response = await http
          .post(API_PATHS.attachments(taskId, UUIDS.vehicles.V1))
          .send(VALID_PAYLOADS.createAttachment.minimal);

        assertCreated(response);
        const data = extractData<any>(response);
        expect(data.uploadedBy).toBe('uploader@example.com');
      });

      it('should create photo attachment', async () => {
        const response = await http
          .post(API_PATHS.attachments(taskId, UUIDS.vehicles.V1))
          .send(VALID_PAYLOADS.createAttachment.photo);

        assertCreated(response);
        const data = extractData<any>(response);

        expect(data.fileType).toBe('photo');
        expect(data.contentType).toBe('image/jpeg');
      });
    });

    describe('Validation Errors', () => {
      it('should reject missing fileUrl', async () => {
        const response = await http
          .post(API_PATHS.attachments(taskId, UUIDS.vehicles.V1))
          .send(INVALID_PAYLOADS.createAttachment.missingFileUrl);

        assertBadRequest(response);
      });

      it('should reject invalid fileUrl format', async () => {
        const response = await http
          .post(API_PATHS.attachments(taskId, UUIDS.vehicles.V1))
          .send(INVALID_PAYLOADS.createAttachment.invalidFileUrl);

        assertBadRequest(response);
      });

      it('should reject missing fileType', async () => {
        const response = await http
          .post(API_PATHS.attachments(taskId, UUIDS.vehicles.V1))
          .send(INVALID_PAYLOADS.createAttachment.missingFileType);

        assertBadRequest(response);
      });
    });

    describe('Tenancy', () => {
      it('should return 404 when vehicle belongs to different tenant', async () => {
        http.setTenantId(UUIDS.tenants.B);

        const response = await http
          .post(API_PATHS.attachments(taskId, UUIDS.vehicles.V1))
          .send(VALID_PAYLOADS.createAttachment.minimal);

        assertNotFound(response);
      });
    });

    describe('Error Cases', () => {
      it('should return 404 for non-existent task', async () => {
        const response = await http
          .post(
            API_PATHS.attachments(UUIDS.nonExistent.TASK, UUIDS.vehicles.V1),
          )
          .send(VALID_PAYLOADS.createAttachment.minimal);

        assertNotFound(response);
      });

      it('should return 404 for non-existent vehicle', async () => {
        const response = await http
          .post(API_PATHS.attachments(taskId, UUIDS.nonExistent.VEHICLE))
          .send(VALID_PAYLOADS.createAttachment.minimal);

        assertNotFound(response);
      });
    });

    describe('Audit Logging', () => {
      it('should create audit log entry', async () => {
        const response = await http
          .post(API_PATHS.attachments(taskId, UUIDS.vehicles.V1))
          .send(VALID_PAYLOADS.createAttachment.minimal);

        assertCreated(response);
        const data = extractData<{ id: string }>(response);

        await verifyCreateAudit(UUIDS.tenants.A, 'attachment', data.id);
      });
    });
  });

  describe('GET /api/maintenance/tasks/:taskId/vehicles/:vehicleId/attachments', () => {
    describe('Happy Path', () => {
      it('should return empty array when no attachments', async () => {
        const response = await http.get(
          API_PATHS.attachments(taskId, UUIDS.vehicles.V1),
        );

        assertOk(response);
        assertDataIsArray(response);
        expect(response.body.data.length).toBe(0);
      });

      it('should return attachments list', async () => {
        // Create attachments first
        await http
          .post(API_PATHS.attachments(taskId, UUIDS.vehicles.V1))
          .send(VALID_PAYLOADS.createAttachment.receipt);
        await http
          .post(API_PATHS.attachments(taskId, UUIDS.vehicles.V1))
          .send(VALID_PAYLOADS.createAttachment.photo);

        const response = await http.get(
          API_PATHS.attachments(taskId, UUIDS.vehicles.V1),
        );

        assertOk(response);
        assertDataIsArray(response);
        expect(response.body.data.length).toBe(2);
      });

      it('should return attachments with correct structure', async () => {
        await http
          .post(API_PATHS.attachments(taskId, UUIDS.vehicles.V1))
          .send(VALID_PAYLOADS.createAttachment.receipt);

        const response = await http.get(
          API_PATHS.attachments(taskId, UUIDS.vehicles.V1),
        );

        assertOk(response);
        const attachment = response.body.data[0];
        assertAttachmentStructure(attachment);
        expect(attachment).toHaveProperty('fileName');
        expect(attachment).toHaveProperty('contentType');
        expect(attachment).toHaveProperty('uploadedBy');
      });
    });

    describe('Tenancy', () => {
      it('should return 404 when accessing attachments for different tenant', async () => {
        // Create attachment as tenant A
        await http
          .post(API_PATHS.attachments(taskId, UUIDS.vehicles.V1))
          .send(VALID_PAYLOADS.createAttachment.minimal);

        // Try to access as tenant B
        http.setTenantId(UUIDS.tenants.B);
        const response = await http.get(
          API_PATHS.attachments(taskId, UUIDS.vehicles.V1),
        );

        assertNotFound(response);
      });
    });

    describe('Error Cases', () => {
      it('should return 404 for non-existent task', async () => {
        const response = await http.get(
          API_PATHS.attachments(UUIDS.nonExistent.TASK, UUIDS.vehicles.V1),
        );

        assertNotFound(response);
      });

      it('should return 404 for non-existent vehicle', async () => {
        const response = await http.get(
          API_PATHS.attachments(taskId, UUIDS.nonExistent.VEHICLE),
        );

        assertNotFound(response);
      });
    });
  });
});
