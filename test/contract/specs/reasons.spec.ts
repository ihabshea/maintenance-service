import { INestApplication } from '@nestjs/common';
import { createTestApp, closeTestApp } from '../helpers/app.helper';
import { HttpClient, API_PATHS, extractData } from '../helpers/http.helper';
import {
  assertOk,
  assertCreated,
  assertBadRequest,
  assertDataIsArray,
  assertReasonStructure,
} from '../helpers/assertions.helper';
import { verifyCreateAudit } from '../helpers/audit.helper';
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
});
