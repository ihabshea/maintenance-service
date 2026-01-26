import { INestApplication } from '@nestjs/common';
import { createTestApp, closeTestApp } from '../helpers/app.helper';
import { HttpClient, API_PATHS } from '../helpers/http.helper';
import { assertBadRequest, assertOk } from '../helpers/assertions.helper';
import { UUIDS, INVALID_UUIDS } from '../fixtures/uuids';

/**
 * Contract Tests: X-Tenant-Id Header Validation
 *
 * Source of Truth: tenancy-model.md
 *
 * All API requests must include the X-Tenant-Id header with a valid UUID.
 * The TenantGuard validates:
 * 1. Header is present
 * 2. Value is a valid UUID v4 format
 */
describe('X-Tenant-Id Header Validation', () => {
  let app: INestApplication;
  let http: HttpClient;

  beforeAll(async () => {
    app = await createTestApp();
    http = new HttpClient(app);
  });

  afterAll(async () => {
    await closeTestApp();
  });

  describe('Missing Header', () => {
    it('should return 400 when X-Tenant-Id header is missing', async () => {
      const response = await http.getWithoutHeaders(API_PATHS.workshops);

      assertBadRequest(response);
      expect(response.body.message).toContain('X-Tenant-Id header is required');
    });

    it('should reject POST requests without X-Tenant-Id header', async () => {
      const response = await http
        .postWithoutHeaders(API_PATHS.tasks)
        .send({ title: 'Test', maintenanceType: 'preventive' });

      assertBadRequest(response);
      expect(response.body.message).toContain('X-Tenant-Id header is required');
    });
  });

  describe('Empty Header', () => {
    it('should return 400 when X-Tenant-Id header is empty', async () => {
      const response = await http.getWithCustomHeaders(API_PATHS.workshops, {
        'X-Tenant-Id': '',
      });

      assertBadRequest(response);
    });
  });

  describe('Invalid UUID Format', () => {
    it('should return 400 when X-Tenant-Id is not a UUID', async () => {
      const response = await http.getWithCustomHeaders(API_PATHS.workshops, {
        'X-Tenant-Id': INVALID_UUIDS.NOT_UUID,
      });

      assertBadRequest(response);
      expect(response.body.message).toContain('X-Tenant-Id must be a valid UUID');
    });

    it('should return 400 when X-Tenant-Id is a partial UUID', async () => {
      const response = await http.getWithCustomHeaders(API_PATHS.workshops, {
        'X-Tenant-Id': INVALID_UUIDS.PARTIAL,
      });

      assertBadRequest(response);
      expect(response.body.message).toContain('X-Tenant-Id must be a valid UUID');
    });

    it('should return 400 when X-Tenant-Id contains spaces', async () => {
      const response = await http.getWithCustomHeaders(API_PATHS.workshops, {
        'X-Tenant-Id': INVALID_UUIDS.WITH_SPACES,
      });

      assertBadRequest(response);
      expect(response.body.message).toContain('X-Tenant-Id must be a valid UUID');
    });
  });

  describe('Valid UUID', () => {
    it('should accept valid UUID v4 format', async () => {
      const response = await http.get(API_PATHS.workshops);

      assertOk(response);
    });

    it('should accept tenant A UUID', async () => {
      http.setTenantId(UUIDS.tenants.A);
      const response = await http.get(API_PATHS.workshops);

      assertOk(response);
    });

    it('should accept tenant B UUID', async () => {
      http.setTenantId(UUIDS.tenants.B);
      const response = await http.get(API_PATHS.workshops);

      assertOk(response);
    });
  });

  describe('X-Actor Header', () => {
    it('should accept requests without X-Actor header (defaults to system)', async () => {
      const response = await http.getWithCustomHeaders(API_PATHS.workshops, {
        'X-Tenant-Id': UUIDS.tenants.A,
      });

      assertOk(response);
    });

    it('should accept custom X-Actor header', async () => {
      const response = await http.getWithCustomHeaders(API_PATHS.workshops, {
        'X-Tenant-Id': UUIDS.tenants.A,
        'X-Actor': 'custom-user@example.com',
      });

      assertOk(response);
    });
  });
});
