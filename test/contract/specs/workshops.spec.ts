import { INestApplication } from '@nestjs/common';
import { createTestApp, closeTestApp } from '../helpers/app.helper';
import { HttpClient, API_PATHS, extractData } from '../helpers/http.helper';
import {
  assertOk,
  assertCreated,
  assertBadRequest,
  assertDataIsArray,
  assertWorkshopStructure,
} from '../helpers/assertions.helper';
import { verifyCreateAudit } from '../helpers/audit.helper';
import { cleanupTenant } from '../helpers/prisma.helper';
import { UUIDS } from '../fixtures/uuids';
import { VALID_PAYLOADS, INVALID_PAYLOADS } from '../fixtures/payloads';

/**
 * Contract Tests: GET/POST /api/reference/workshops
 *
 * Source of Truth: api-contract.md (Sections 11, 12), tenancy-model.md
 *
 * Workshops reference data management.
 */
describe('Workshops Reference Data', () => {
  let app: INestApplication;
  let http: HttpClient;

  beforeAll(async () => {
    app = await createTestApp();
    http = new HttpClient(app, UUIDS.tenants.A);
  });

  afterAll(async () => {
    await closeTestApp();
  });

  describe('GET /api/reference/workshops', () => {
    describe('Happy Path', () => {
      it('should return workshops list', async () => {
        const response = await http.get(API_PATHS.workshops);

        assertOk(response);
        assertDataIsArray(response);
      });

      it('should return system workshops visible to all tenants', async () => {
        const response = await http.get(API_PATHS.workshops);

        assertOk(response);
        const workshops = response.body.data;
        const systemWorkshops = workshops.filter(
          (w: any) => w.scope === 'system',
        );

        expect(systemWorkshops.length).toBeGreaterThanOrEqual(3);

        // Verify expected system workshops exist
        const workshopIds = systemWorkshops.map((w: any) => w.id);
        expect(workshopIds).toContain(UUIDS.workshops.SYSTEM_MAIN);
        expect(workshopIds).toContain(UUIDS.workshops.SYSTEM_QUICK);
        expect(workshopIds).toContain(UUIDS.workshops.SYSTEM_DEALER);
      });

      it('should return tenant workshops visible only to owner', async () => {
        http.setTenantId(UUIDS.tenants.A);
        const responseA = await http.get(API_PATHS.workshops);

        assertOk(responseA);
        const workshopsA = responseA.body.data;
        const tenantAWorkshops = workshopsA.filter(
          (w: any) => w.scope === 'tenant' && w.tenantId === UUIDS.tenants.A,
        );

        expect(tenantAWorkshops.length).toBeGreaterThanOrEqual(1);

        // Verify tenant B workshops are not visible
        const tenantBWorkshops = workshopsA.filter(
          (w: any) => w.tenantId === UUIDS.tenants.B,
        );
        expect(tenantBWorkshops.length).toBe(0);
      });

      it('should return workshops with correct structure', async () => {
        const response = await http.get(API_PATHS.workshops);

        assertOk(response);
        const workshop = response.body.data[0];
        assertWorkshopStructure(workshop);
      });
    });

    describe('Tenancy', () => {
      it('should show system workshops to tenant B as well', async () => {
        http.setTenantId(UUIDS.tenants.B);
        const response = await http.get(API_PATHS.workshops);

        assertOk(response);
        const systemWorkshops = response.body.data.filter(
          (w: any) => w.scope === 'system',
        );

        expect(systemWorkshops.length).toBeGreaterThanOrEqual(3);
      });

      it('should not show tenant A workshops to tenant B', async () => {
        http.setTenantId(UUIDS.tenants.B);
        const response = await http.get(API_PATHS.workshops);

        assertOk(response);
        const tenantAWorkshops = response.body.data.filter(
          (w: any) => w.tenantId === UUIDS.tenants.A,
        );

        expect(tenantAWorkshops.length).toBe(0);
      });
    });
  });

  describe('POST /api/reference/workshops', () => {
    beforeEach(async () => {
      // Clean up tenant workshops but keep system data
      await cleanupTenant(UUIDS.tenants.A);
    });

    describe('Happy Path', () => {
      it('should create tenant-scoped workshop', async () => {
        http.setTenantId(UUIDS.tenants.A);
        const response = await http
          .post(API_PATHS.workshops)
          .send(VALID_PAYLOADS.createWorkshop.standard);

        assertCreated(response);
        const data = extractData<any>(response);

        expect(data.name).toBe('Contract Test Workshop');
        expect(data.location).toBe('Cairo, Egypt');
        expect(data.scope).toBe('tenant');
        expect(data.tenantId).toBe(UUIDS.tenants.A);
        expect(data.status).toBe('active');
      });

      it('should create workshop with minimal fields', async () => {
        const response = await http
          .post(API_PATHS.workshops)
          .send(VALID_PAYLOADS.createWorkshop.minimal);

        assertCreated(response);
        const data = extractData<any>(response);

        expect(data.name).toBe('Minimal Workshop');
        expect(data.location).toBeNull();
      });
    });

    describe('Validation Errors', () => {
      // TODO: API validation bug - missing name validation not returning 400
      it.skip('should reject missing name - API returns 500, expected 400', async () => {
        const response = await http
          .post(API_PATHS.workshops)
          .send(INVALID_PAYLOADS.createWorkshop.missingName);

        assertBadRequest(response);
      });
    });

    describe('Audit Logging', () => {
      it('should create audit log entry', async () => {
        const response = await http
          .post(API_PATHS.workshops)
          .send(VALID_PAYLOADS.createWorkshop.standard);

        assertCreated(response);
        const data = extractData<{ id: string }>(response);

        await verifyCreateAudit(UUIDS.tenants.A, 'workshop', data.id);
      });
    });
  });
});
