import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, closeTestApp } from '../helpers/app.helper';
import { HttpClient } from '../helpers/http.helper';
import {
  assertCreated,
  assertBadRequest,
  assertUploadStructure,
} from '../helpers/assertions.helper';
import { verifyCreateAudit } from '../helpers/audit.helper';
import { cleanupTenant, getPrisma } from '../helpers/prisma.helper';
import { UUIDS } from '../fixtures/uuids';

/**
 * Contract Tests: POST /api/uploads
 *
 * File upload endpoint for storing files in MinIO object storage.
 * Note: These tests require MinIO to be running.
 */
describe('Uploads', () => {
  let app: INestApplication;
  let http: HttpClient;
  let minioAvailable = true;

  beforeAll(async () => {
    app = await createTestApp();
    http = new HttpClient(app, UUIDS.tenants.A);

    // Check if MinIO is available by attempting a simple operation
    try {
      const response = await request(app.getHttpServer())
        .post('/api/uploads')
        .set('X-Tenant-Id', UUIDS.tenants.A)
        .set('X-Actor', 'test')
        .attach('file', Buffer.from('test'), 'test.txt');

      // If we get a response (even error), MinIO might be available
      // A 500 with specific MinIO error would indicate it's not
      if (
        response.status === 500 &&
        response.body?.message?.includes('connect')
      ) {
        minioAvailable = false;
      }
    } catch {
      minioAvailable = false;
    }
  });

  afterAll(async () => {
    await closeTestApp();
  });

  beforeEach(async () => {
    if (!minioAvailable) return;

    http.setTenantId(UUIDS.tenants.A);
    await cleanupTenant(UUIDS.tenants.A);
    await cleanupTenant(UUIDS.tenants.B);
  });

  describe('POST /api/uploads', () => {
    describe('Happy Path', () => {
      it('should upload a file successfully', async () => {
        if (!minioAvailable) {
          console.log('Skipping: MinIO not available');
          return;
        }

        const response = await request(app.getHttpServer())
          .post('/api/uploads')
          .set('X-Tenant-Id', UUIDS.tenants.A)
          .set('X-Actor', 'uploader@example.com')
          .attach('file', Buffer.from('test content'), {
            filename: 'test-document.pdf',
            contentType: 'application/pdf',
          });

        assertCreated(response);
        const data = response.body.data;

        assertUploadStructure(data);
        expect(data.fileName).toBe('test-document.pdf');
        expect(data.contentType).toBe('application/pdf');
        expect(data.fileSize).toBeGreaterThan(0);
        expect(data.fileUrl).toContain(UUIDS.tenants.A);
      });

      it('should upload an image file', async () => {
        if (!minioAvailable) {
          console.log('Skipping: MinIO not available');
          return;
        }

        const imageBuffer = Buffer.from('fake image content');

        const response = await request(app.getHttpServer())
          .post('/api/uploads')
          .set('X-Tenant-Id', UUIDS.tenants.A)
          .set('X-Actor', 'test')
          .attach('file', imageBuffer, {
            filename: 'photo.jpg',
            contentType: 'image/jpeg',
          });

        assertCreated(response);
        expect(response.body.data.contentType).toBe('image/jpeg');
        expect(response.body.data.fileName).toBe('photo.jpg');
      });

      it('should sanitize special characters in filename', async () => {
        if (!minioAvailable) {
          console.log('Skipping: MinIO not available');
          return;
        }

        const response = await request(app.getHttpServer())
          .post('/api/uploads')
          .set('X-Tenant-Id', UUIDS.tenants.A)
          .set('X-Actor', 'test')
          .attach('file', Buffer.from('content'), {
            filename: 'file with spaces (1).pdf',
            contentType: 'application/pdf',
          });

        assertCreated(response);
        // Original filename is preserved in DB
        expect(response.body.data.fileName).toBe('file with spaces (1).pdf');
        // But URL should have sanitized version
        expect(response.body.data.fileUrl).toContain(
          'file_with_spaces__1_.pdf',
        );
      });
    });

    describe('Validation Errors', () => {
      it('should reject request without file', async () => {
        if (!minioAvailable) {
          console.log('Skipping: MinIO not available');
          return;
        }

        const response = await request(app.getHttpServer())
          .post('/api/uploads')
          .set('X-Tenant-Id', UUIDS.tenants.A)
          .set('X-Actor', 'test');

        assertBadRequest(response);
        expect(response.body.message).toContain('No file provided');
      });
    });

    describe('Tenancy', () => {
      it('should store file with tenant-specific path', async () => {
        if (!minioAvailable) {
          console.log('Skipping: MinIO not available');
          return;
        }

        // Upload as Tenant A
        const responseA = await request(app.getHttpServer())
          .post('/api/uploads')
          .set('X-Tenant-Id', UUIDS.tenants.A)
          .set('X-Actor', 'test')
          .attach('file', Buffer.from('tenant A file'), 'tenantA.txt');

        assertCreated(responseA);
        expect(responseA.body.data.fileUrl).toContain(UUIDS.tenants.A);

        // Upload as Tenant B
        const responseB = await request(app.getHttpServer())
          .post('/api/uploads')
          .set('X-Tenant-Id', UUIDS.tenants.B)
          .set('X-Actor', 'test')
          .attach('file', Buffer.from('tenant B file'), 'tenantB.txt');

        assertCreated(responseB);
        expect(responseB.body.data.fileUrl).toContain(UUIDS.tenants.B);

        // Verify files are stored in tenant-specific directories
        expect(responseA.body.data.fileUrl).not.toBe(
          responseB.body.data.fileUrl,
        );
      });
    });

    describe('Audit Logging', () => {
      it('should create audit log entry for upload', async () => {
        if (!minioAvailable) {
          console.log('Skipping: MinIO not available');
          return;
        }

        const response = await request(app.getHttpServer())
          .post('/api/uploads')
          .set('X-Tenant-Id', UUIDS.tenants.A)
          .set('X-Actor', 'uploader@example.com')
          .attach('file', Buffer.from('audit test'), 'audit-test.txt');

        assertCreated(response);
        const data = response.body.data;

        await verifyCreateAudit(UUIDS.tenants.A, 'upload', data.id);
      });
    });

    describe('Upload Claiming', () => {
      it('should mark upload as unclaimed initially', async () => {
        if (!minioAvailable) {
          console.log('Skipping: MinIO not available');
          return;
        }

        const response = await request(app.getHttpServer())
          .post('/api/uploads')
          .set('X-Tenant-Id', UUIDS.tenants.A)
          .set('X-Actor', 'test')
          .attach('file', Buffer.from('unclaimed test'), 'unclaimed.txt');

        assertCreated(response);

        // Verify in database that claimedAt is null
        const prisma = getPrisma();
        const upload = await prisma.upload.findUnique({
          where: { id: response.body.data.id },
        });

        expect(upload).not.toBeNull();
        expect(upload?.claimedAt).toBeNull();
      });
    });
  });
});
