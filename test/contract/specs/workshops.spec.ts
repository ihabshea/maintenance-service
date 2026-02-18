import { INestApplication } from '@nestjs/common';
import { createTestApp, closeTestApp } from '../helpers/app.helper';
import { HttpClient, API_PATHS, extractData } from '../helpers/http.helper';
import {
  assertOk,
  assertCreated,
  assertBadRequest,
  assertNotFound,
  assertForbidden,
  assertDataIsArray,
  assertWorkshopStructure,
} from '../helpers/assertions.helper';
import {
  verifyCreateAudit,
  verifyUpdateAudit,
  verifyDeleteAudit,
} from '../helpers/audit.helper';
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
      it('should reject missing name', async () => {
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

  describe('PATCH /api/reference/workshops/:id', () => {
    let tenantWorkshopId: string;

    beforeEach(async () => {
      await cleanupTenant(UUIDS.tenants.A);
      http.setTenantId(UUIDS.tenants.A);

      // Create a tenant workshop to update
      const response = await http
        .post(API_PATHS.workshops)
        .send(VALID_PAYLOADS.createWorkshop.standard);
      tenantWorkshopId = extractData<any>(response).id;
    });

    describe('Happy Path', () => {
      it('should update workshop name and location', async () => {
        const response = await http
          .patch(API_PATHS.workshop(tenantWorkshopId))
          .send(VALID_PAYLOADS.updateWorkshop.standard);

        assertOk(response);
        const data = extractData<any>(response);

        expect(data.name).toBe('Updated Workshop Name');
        expect(data.location).toBe('Updated Location');
        expect(data.id).toBe(tenantWorkshopId);
      });

      it('should allow partial update (name only)', async () => {
        const response = await http
          .patch(API_PATHS.workshop(tenantWorkshopId))
          .send(VALID_PAYLOADS.updateWorkshop.nameOnly);

        assertOk(response);
        const data = extractData<any>(response);

        expect(data.name).toBe('Name Only Update');
        // location should remain unchanged
        expect(data.location).toBe('Cairo, Egypt');
      });
    });

    describe('Error Cases', () => {
      it('should return 404 for non-existent workshop', async () => {
        const response = await http
          .patch(API_PATHS.workshop(UUIDS.nonExistent.WORKSHOP))
          .send(VALID_PAYLOADS.updateWorkshop.standard);

        assertNotFound(response);
      });

      it('should return 403 for system workshop', async () => {
        const response = await http
          .patch(API_PATHS.workshop(UUIDS.workshops.SYSTEM_MAIN))
          .send(VALID_PAYLOADS.updateWorkshop.standard);

        assertForbidden(response);
      });
    });

    describe('Audit Logging', () => {
      it('should create update audit log entry', async () => {
        await http
          .patch(API_PATHS.workshop(tenantWorkshopId))
          .send(VALID_PAYLOADS.updateWorkshop.standard);

        await verifyUpdateAudit(UUIDS.tenants.A, 'workshop', tenantWorkshopId);
      });
    });

    describe('Tenant Isolation', () => {
      it('should not allow tenant B to update tenant A workshop', async () => {
        http.setTenantId(UUIDS.tenants.B);
        const response = await http
          .patch(API_PATHS.workshop(tenantWorkshopId))
          .send(VALID_PAYLOADS.updateWorkshop.standard);

        assertNotFound(response);
      });
    });
  });

  describe('DELETE /api/reference/workshops/:id', () => {
    let tenantWorkshopId: string;

    beforeEach(async () => {
      await cleanupTenant(UUIDS.tenants.A);
      http.setTenantId(UUIDS.tenants.A);

      // Create a tenant workshop to delete
      const response = await http
        .post(API_PATHS.workshops)
        .send(VALID_PAYLOADS.createWorkshop.standard);
      tenantWorkshopId = extractData<any>(response).id;
    });

    describe('Happy Path', () => {
      it('should soft-delete workshop by setting status to inactive', async () => {
        const response = await http.delete(
          API_PATHS.workshop(tenantWorkshopId),
        );

        assertOk(response);
        const data = extractData<any>(response);

        expect(data.status).toBe('inactive');
        expect(data.id).toBe(tenantWorkshopId);
      });

      it('should not return deleted workshop in GET list', async () => {
        await http.delete(API_PATHS.workshop(tenantWorkshopId));

        const listResponse = await http.get(API_PATHS.workshops);
        assertOk(listResponse);

        const workshops = listResponse.body.data;
        const found = workshops.find((w: any) => w.id === tenantWorkshopId);
        expect(found).toBeUndefined();
      });
    });

    describe('Error Cases', () => {
      it('should return 404 for non-existent workshop', async () => {
        const response = await http.delete(
          API_PATHS.workshop(UUIDS.nonExistent.WORKSHOP),
        );

        assertNotFound(response);
      });

      it('should return 403 for system workshop', async () => {
        const response = await http.delete(
          API_PATHS.workshop(UUIDS.workshops.SYSTEM_MAIN),
        );

        assertForbidden(response);
      });
    });

    describe('Audit Logging', () => {
      it('should create delete audit log entry', async () => {
        await http.delete(API_PATHS.workshop(tenantWorkshopId));

        await verifyDeleteAudit(UUIDS.tenants.A, 'workshop', tenantWorkshopId);
      });
    });

    describe('Tenant Isolation', () => {
      it('should not allow tenant B to delete tenant A workshop', async () => {
        http.setTenantId(UUIDS.tenants.B);
        const response = await http.delete(
          API_PATHS.workshop(tenantWorkshopId),
        );

        assertNotFound(response);
      });
    });
  });
});
