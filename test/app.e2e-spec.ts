import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Maintenance Service (e2e)', () => {
  let app: INestApplication;

  const tenantId = 'a1111111-1111-4111-8111-111111111111';
  const headers = { 'X-Tenant-Id': tenantId, 'X-Actor': 'test-user' };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Health Check', () => {
    it('should reject requests without tenant ID', () => {
      return request(app.getHttpServer())
        .get('/api/reference/workshops')
        .expect(400);
    });
  });

  describe('Reference Data', () => {
    it('GET /api/reference/workshops - should return workshops', () => {
      return request(app.getHttpServer())
        .get('/api/reference/workshops')
        .set(headers)
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toBeDefined();
          expect(Array.isArray(res.body.data)).toBe(true);
        });
    });

    it('POST /api/reference/workshops - should create tenant workshop', () => {
      return request(app.getHttpServer())
        .post('/api/reference/workshops')
        .set(headers)
        .send({ name: 'E2E Test Workshop', location: 'Test Location' })
        .expect(201)
        .expect((res) => {
          expect(res.body.data.name).toBe('E2E Test Workshop');
          expect(res.body.data.scope).toBe('tenant');
          expect(res.body.data.tenantId).toBe(tenantId);
        });
    });

    it('GET /api/reference/reasons - should return reasons', () => {
      return request(app.getHttpServer())
        .get('/api/reference/reasons?type=cancellation')
        .set(headers)
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toBeDefined();
          expect(Array.isArray(res.body.data)).toBe(true);
        });
    });

    it('POST /api/reference/reasons - should create tenant reason', () => {
      return request(app.getHttpServer())
        .post('/api/reference/reasons')
        .set(headers)
        .send({ reasonType: 'cancellation', label: 'E2E Test Reason' })
        .expect(201)
        .expect((res) => {
          expect(res.body.data.label).toBe('E2E Test Reason');
          expect(res.body.data.scope).toBe('tenant');
        });
    });
  });

  describe('Maintenance Tasks', () => {
    let taskId: string;
    const vehicleId = 'b2222222-2222-4222-8222-222222222222';

    it('POST /api/maintenance/tasks - should create task with vehicles', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/maintenance/tasks')
        .set(headers)
        .send({
          title: 'E2E Oil Change Test',
          maintenanceType: 'preventive',
          triggerMode: 'mileage',
          triggerKm: 5000,
          vehicles: [
            { vehicleId, dueOdometerKm: 50000, dueDate: '2025-06-01' },
          ],
          checklist: [
            { jobCode: 'OIL001', label: 'Drain old oil', sortOrder: 1 },
            { jobCode: 'OIL002', label: 'Replace filter', sortOrder: 2 },
          ],
        })
        .expect(201);

      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.title).toBe('E2E Oil Change Test');
      taskId = response.body.data.id;
    });

    it('GET /api/maintenance/tasks/:taskId - should return task with details', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/maintenance/tasks/${taskId}`)
        .set(headers)
        .expect(200);

      expect(response.body.data.id).toBe(taskId);
      expect(response.body.data.vehicles).toBeDefined();
      expect(response.body.data.jobs).toBeDefined();
      expect(response.body.data.vehicles.length).toBe(1);
      expect(response.body.data.jobs.length).toBe(2);
    });

    it('POST /api/maintenance/tasks/:taskId/vehicles - should add vehicles', async () => {
      const newVehicleId = 'c3333333-3333-4333-8333-333333333333';

      await request(app.getHttpServer())
        .post(`/api/maintenance/tasks/${taskId}/vehicles`)
        .set(headers)
        .send({
          vehicles: [{ vehicleId: newVehicleId, dueOdometerKm: 60000 }],
        })
        .expect(201);

      const response = await request(app.getHttpServer())
        .get(`/api/maintenance/tasks/${taskId}`)
        .set(headers)
        .expect(200);

      expect(response.body.data.vehicles.length).toBe(2);
    });

    it('GET /api/vehicles/:vehicleId/maintenance - should list vehicle maintenance', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/vehicles/${vehicleId}/maintenance`)
        .set(headers)
        .expect(200);

      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('PATCH /api/maintenance/tasks/:taskId/vehicles/:vehicleId/status/completed - should complete', async () => {
      await request(app.getHttpServer())
        .patch(
          `/api/maintenance/tasks/${taskId}/vehicles/${vehicleId}/status/completed`,
        )
        .set(headers)
        .send({
          completionDate: '2025-01-15',
          actualOdometerKm: 50500,
          workshop: { mode: 'custom', customName: 'E2E Workshop' },
          cost: { amount: 150, currency: 'EGP' },
          jobs: [
            { jobCode: 'OIL001', status: 'done' },
            { jobCode: 'OIL002', status: 'done' },
          ],
        })
        .expect(200);

      const response = await request(app.getHttpServer())
        .get(`/api/maintenance/tasks/${taskId}`)
        .set(headers)
        .expect(200);

      const vehicle = response.body.data.vehicles.find(
        (v: { vehicleId: string }) => v.vehicleId === vehicleId,
      );
      expect(vehicle.status).toBe('completed');
    });

    it('POST /api/maintenance/tasks/:taskId/vehicles/:vehicleId/corrections - should correct completed', async () => {
      await request(app.getHttpServer())
        .post(
          `/api/maintenance/tasks/${taskId}/vehicles/${vehicleId}/corrections`,
        )
        .set(headers)
        .send({
          correctionReason: 'Cost was incorrectly recorded',
          patch: { costAmount: 200 },
        })
        .expect(201);
    });
  });

  describe('Attachments', () => {
    let taskId: string;
    const vehicleId = 'd4444444-4444-4444-8444-444444444444';

    beforeAll(async () => {
      const response = await request(app.getHttpServer())
        .post('/api/maintenance/tasks')
        .set(headers)
        .send({
          title: 'Attachment Test Task',
          maintenanceType: 'corrective',
          vehicles: [{ vehicleId }],
        });
      taskId = response.body.data.id;
    });

    it('POST /api/maintenance/tasks/:taskId/vehicles/:vehicleId/attachments - should create', async () => {
      const response = await request(app.getHttpServer())
        .post(
          `/api/maintenance/tasks/${taskId}/vehicles/${vehicleId}/attachments`,
        )
        .set(headers)
        .send({
          fileUrl: 'https://example.com/receipt.pdf',
          fileType: 'receipt',
          fileName: 'invoice.pdf',
          contentType: 'application/pdf',
        })
        .expect(201);

      expect(response.body.data.fileUrl).toBe(
        'https://example.com/receipt.pdf',
      );
    });

    it('GET /api/maintenance/tasks/:taskId/vehicles/:vehicleId/attachments - should list', async () => {
      const response = await request(app.getHttpServer())
        .get(
          `/api/maintenance/tasks/${taskId}/vehicles/${vehicleId}/attachments`,
        )
        .set(headers)
        .expect(200);

      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('Reports', () => {
    it('GET /api/reports/maintenance-status - should return maintenance status report', () => {
      return request(app.getHttpServer())
        .get('/api/reports/maintenance-status')
        .set(headers)
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toBeDefined();
          expect(res.body.data.completed).toBeDefined();
          expect(res.body.data.cancelled).toBeDefined();
          expect(res.body.data.rescheduled).toBeDefined();
          expect(Array.isArray(res.body.data.completed)).toBe(true);
          expect(Array.isArray(res.body.data.cancelled)).toBe(true);
          expect(Array.isArray(res.body.data.rescheduled)).toBe(true);
        });
    });

    it('GET /api/reports/overdue-preventive - should return overdue preventive report', () => {
      return request(app.getHttpServer())
        .get('/api/reports/overdue-preventive')
        .set(headers)
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toBeDefined();
          expect(Array.isArray(res.body.data)).toBe(true);
        });
    });

    it('GET /api/reports/cost-summary - should return cost summary report', () => {
      return request(app.getHttpServer())
        .get('/api/reports/cost-summary')
        .set(headers)
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toBeDefined();
          expect(typeof res.body.data.totalCost).toBe('number');
          expect(typeof res.body.data.totalCount).toBe('number');
          expect(typeof res.body.data.averageCost).toBe('number');
          expect(Array.isArray(res.body.data.byStatus)).toBe(true);
        });
    });

    it('GET /api/reports/corrective-vs-preventive - should return comparison report', () => {
      return request(app.getHttpServer())
        .get('/api/reports/corrective-vs-preventive')
        .set(headers)
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toBeDefined();
          expect(res.body.data.preventive).toBeDefined();
          expect(res.body.data.corrective).toBeDefined();
          expect(res.body.data.ratio).toBeDefined();
          expect(typeof res.body.data.preventive.count).toBe('number');
          expect(typeof res.body.data.corrective.count).toBe('number');
        });
    });

    it('GET /api/reports/maintenance-status - should filter by date range', () => {
      return request(app.getHttpServer())
        .get('/api/reports/maintenance-status')
        .query({ fromDate: '2025-01-01', toDate: '2025-12-31' })
        .set(headers)
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toBeDefined();
        });
    });

    it('GET /api/reports/cost-summary - should filter by vehicle', () => {
      const vehicleId = 'b2222222-2222-4222-8222-222222222222';
      return request(app.getHttpServer())
        .get('/api/reports/cost-summary')
        .query({ vehicleId })
        .set(headers)
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toBeDefined();
        });
    });

    it('should reject reports requests without tenant ID', () => {
      return request(app.getHttpServer())
        .get('/api/reports/maintenance-status')
        .expect(400);
    });
  });

  describe('Validation', () => {
    it('should reject invalid maintenance type', () => {
      return request(app.getHttpServer())
        .post('/api/maintenance/tasks')
        .set(headers)
        .send({
          title: 'Test',
          maintenanceType: 'invalid',
        })
        .expect(400);
    });

    it('should reject missing required fields', () => {
      return request(app.getHttpServer())
        .post('/api/maintenance/tasks')
        .set(headers)
        .send({})
        .expect(400);
    });

    it('should reject non-whitelisted fields', () => {
      return request(app.getHttpServer())
        .post('/api/maintenance/tasks')
        .set(headers)
        .send({
          title: 'Test',
          maintenanceType: 'preventive',
          unknownField: 'should be rejected',
        })
        .expect(400);
    });
  });
});
