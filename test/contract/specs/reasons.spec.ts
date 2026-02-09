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
  assertReasonStructure,
} from '../helpers/assertions.helper';
import { verifyCreateAudit, verifyUpdateAudit, verifyDeleteAudit } from '../helpers/audit.helper';
import { cleanupTenant } from '../helpers/prisma.helper';
import { UUIDS } from '../fixtures/uuids';
import { VALID_PAYLOADS, INVALID_PAYLOADS } from '../fixtures/payloads';

/**
 * Contract Tests: GET/POST /api/reference/reasons
 *
 * Source of Truth: api-contract.md (Sections 13, 14), tenancy-model.md
 *
 * Reasons reference data management (cancellation reasons).
 */
describe('Reasons Reference Data', () => {
  let app: INestApplication;
  let http: HttpClient;

  beforeAll(async () => {
    app = await createTestApp();
    http = new HttpClient(app, UUIDS.tenants.A);
  });

  afterAll(async () => {
    await closeTestApp();
  });

  describe('GET /api/reference/reasons', () => {
    describe('Happy Path', () => {
      it('should return reasons list', async () => {
        const response = await http.get(API_PATHS.reasons);

        assertOk(response);
        assertDataIsArray(response);
      });

      it('should return system reasons visible to all tenants', async () => {
        const response = await http.get(API_PATHS.reasons);

        assertOk(response);
        const reasons = response.body.data;
        const systemReasons = reasons.filter((r: any) => r.scope === 'system');

        expect(systemReasons.length).toBeGreaterThanOrEqual(2);

        // Verify expected system reasons exist
        const reasonIds = systemReasons.map((r: any) => r.id);
        expect(reasonIds).toContain(UUIDS.reasons.SYSTEM_SOLD);
        expect(reasonIds).toContain(UUIDS.reasons.SYSTEM_DECOMMISSIONED);
      });

      it('should return tenant reasons visible only to owner', async () => {
        http.setTenantId(UUIDS.tenants.A);
        const responseA = await http.get(API_PATHS.reasons);

        assertOk(responseA);
        const reasonsA = responseA.body.data;
        const tenantAReasons = reasonsA.filter(
          (r: any) => r.scope === 'tenant' && r.tenantId === UUIDS.tenants.A,
        );

        expect(tenantAReasons.length).toBeGreaterThanOrEqual(1);

        // Verify tenant B reasons are not visible
        const tenantBReasons = reasonsA.filter(
          (r: any) => r.tenantId === UUIDS.tenants.B,
        );
        expect(tenantBReasons.length).toBe(0);
      });

      it('should return reasons with correct structure', async () => {
        const response = await http.get(API_PATHS.reasons);

        assertOk(response);
        const reason = response.body.data[0];
        assertReasonStructure(reason);
      });
    });

    describe('Filtering', () => {
      it('should filter by type=cancellation', async () => {
        const response = await http
          .get(API_PATHS.reasons)
          .query({ type: 'cancellation' });

        assertOk(response);
        const reasons = response.body.data;
        reasons.forEach((r: any) => {
          expect(r.reasonType).toBe('cancellation');
        });
      });
    });

    describe('Tenancy', () => {
      it('should show system reasons to tenant B as well', async () => {
        http.setTenantId(UUIDS.tenants.B);
        const response = await http.get(API_PATHS.reasons);

        assertOk(response);
        const systemReasons = response.body.data.filter(
          (r: any) => r.scope === 'system',
        );

        expect(systemReasons.length).toBeGreaterThanOrEqual(2);
      });

      it('should not show tenant A reasons to tenant B', async () => {
        http.setTenantId(UUIDS.tenants.B);
        const response = await http.get(API_PATHS.reasons);

        assertOk(response);
        const tenantAReasons = response.body.data.filter(
          (r: any) => r.tenantId === UUIDS.tenants.A,
        );

        expect(tenantAReasons.length).toBe(0);
      });
    });
  });

  describe('POST /api/reference/reasons', () => {
    beforeEach(async () => {
      await cleanupTenant(UUIDS.tenants.A);
    });

    describe('Happy Path', () => {
      it('should create tenant-scoped cancellation reason', async () => {
        http.setTenantId(UUIDS.tenants.A);
        const response = await http
          .post(API_PATHS.reasons)
          .send(VALID_PAYLOADS.createReason.cancellation);

        assertCreated(response);
        const data = extractData<any>(response);

        expect(data.label).toBe('Contract Test Reason');
        expect(data.reasonType).toBe('cancellation');
        expect(data.scope).toBe('tenant');
        expect(data.tenantId).toBe(UUIDS.tenants.A);
        expect(data.status).toBe('active');
      });
    });

    describe('Validation Errors', () => {
      it('should reject missing reasonType', async () => {
        const response = await http
          .post(API_PATHS.reasons)
          .send(INVALID_PAYLOADS.createReason.missingReasonType);

        assertBadRequest(response);
      });

      it('should reject missing label', async () => {
        const response = await http
          .post(API_PATHS.reasons)
          .send(INVALID_PAYLOADS.createReason.missingLabel);

        assertBadRequest(response);
      });

      it('should reject invalid reasonType enum', async () => {
        const response = await http
          .post(API_PATHS.reasons)
          .send(INVALID_PAYLOADS.createReason.invalidReasonType);

        assertBadRequest(response);
      });
    });

    describe('Audit Logging', () => {
      it('should create audit log entry', async () => {
        const response = await http
          .post(API_PATHS.reasons)
          .send(VALID_PAYLOADS.createReason.cancellation);

        assertCreated(response);
        const data = extractData<{ id: string }>(response);

        await verifyCreateAudit(UUIDS.tenants.A, 'reason', data.id);
      });
    });
  });

  describe('PATCH /api/reference/reasons/:id', () => {
    let tenantReasonId: string;

    beforeEach(async () => {
      await cleanupTenant(UUIDS.tenants.A);
      http.setTenantId(UUIDS.tenants.A);

      // Create a tenant reason to update
      const response = await http
        .post(API_PATHS.reasons)
        .send(VALID_PAYLOADS.createReason.cancellation);
      tenantReasonId = extractData<any>(response).id;
    });

    describe('Happy Path', () => {
      it('should update reason label', async () => {
        const response = await http
          .patch(API_PATHS.reason(tenantReasonId))
          .send(VALID_PAYLOADS.updateReason.standard);

        assertOk(response);
        const data = extractData<any>(response);

        expect(data.label).toBe('Updated Reason Label');
        expect(data.id).toBe(tenantReasonId);
      });

      it('should allow partial update (status only)', async () => {
        const response = await http
          .patch(API_PATHS.reason(tenantReasonId))
          .send(VALID_PAYLOADS.updateReason.statusOnly);

        assertOk(response);
        const data = extractData<any>(response);

        expect(data.status).toBe('inactive');
      });
    });

    describe('Error Cases', () => {
      it('should return 404 for non-existent reason', async () => {
        const response = await http
          .patch(API_PATHS.reason(UUIDS.nonExistent.REASON))
          .send(VALID_PAYLOADS.updateReason.standard);

        assertNotFound(response);
      });

      it('should return 403 for system reason', async () => {
        const response = await http
          .patch(API_PATHS.reason(UUIDS.reasons.SYSTEM_SOLD))
          .send(VALID_PAYLOADS.updateReason.standard);

        assertForbidden(response);
      });
    });

    describe('Audit Logging', () => {
      it('should create update audit log entry', async () => {
        await http
          .patch(API_PATHS.reason(tenantReasonId))
          .send(VALID_PAYLOADS.updateReason.standard);

        await verifyUpdateAudit(UUIDS.tenants.A, 'reason', tenantReasonId);
      });
    });

    describe('Tenant Isolation', () => {
      it('should not allow tenant B to update tenant A reason', async () => {
        http.setTenantId(UUIDS.tenants.B);
        const response = await http
          .patch(API_PATHS.reason(tenantReasonId))
          .send(VALID_PAYLOADS.updateReason.standard);

        assertNotFound(response);
      });
    });
  });

  describe('DELETE /api/reference/reasons/:id', () => {
    let tenantReasonId: string;

    beforeEach(async () => {
      await cleanupTenant(UUIDS.tenants.A);
      http.setTenantId(UUIDS.tenants.A);

      // Create a tenant reason to delete
      const response = await http
        .post(API_PATHS.reasons)
        .send(VALID_PAYLOADS.createReason.cancellation);
      tenantReasonId = extractData<any>(response).id;
    });

    describe('Happy Path', () => {
      it('should soft-delete reason by setting status to inactive', async () => {
        const response = await http
          .delete(API_PATHS.reason(tenantReasonId));

        assertOk(response);
        const data = extractData<any>(response);

        expect(data.status).toBe('inactive');
        expect(data.id).toBe(tenantReasonId);
      });

      it('should not return deleted reason in GET list', async () => {
        await http.delete(API_PATHS.reason(tenantReasonId));

        const listResponse = await http.get(API_PATHS.reasons);
        assertOk(listResponse);

        const reasons = listResponse.body.data;
        const found = reasons.find((r: any) => r.id === tenantReasonId);
        expect(found).toBeUndefined();
      });
    });

    describe('Error Cases', () => {
      it('should return 404 for non-existent reason', async () => {
        const response = await http
          .delete(API_PATHS.reason(UUIDS.nonExistent.REASON));

        assertNotFound(response);
      });

      it('should return 403 for system reason', async () => {
        const response = await http
          .delete(API_PATHS.reason(UUIDS.reasons.SYSTEM_SOLD));

        assertForbidden(response);
      });
    });

    describe('Audit Logging', () => {
      it('should create delete audit log entry', async () => {
        await http.delete(API_PATHS.reason(tenantReasonId));

        await verifyDeleteAudit(UUIDS.tenants.A, 'reason', tenantReasonId);
      });
    });

    describe('Tenant Isolation', () => {
      it('should not allow tenant B to delete tenant A reason', async () => {
        http.setTenantId(UUIDS.tenants.B);
        const response = await http
          .delete(API_PATHS.reason(tenantReasonId));

        assertNotFound(response);
      });
    });
  });
});
