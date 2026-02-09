import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { UUIDS } from '../fixtures/uuids';

/**
 * HTTP response type from supertest.
 */
export type HttpResponse = request.Response;

/**
 * HTTP client wrapper with tenant header support.
 */
export class HttpClient {
  private app: INestApplication;
  private tenantId: string;
  private actor: string;

  constructor(app: INestApplication, tenantId: string = UUIDS.tenants.A) {
    this.app = app;
    this.tenantId = tenantId;
    this.actor = 'contract-test';
  }

  /**
   * Sets the tenant ID for subsequent requests.
   */
  setTenantId(tenantId: string): this {
    this.tenantId = tenantId;
    return this;
  }

  /**
   * Sets the actor for subsequent requests.
   */
  setActor(actor: string): this {
    this.actor = actor;
    return this;
  }

  /**
   * Returns the base headers with tenant and actor.
   */
  private getHeaders(): Record<string, string> {
    return {
      'X-Tenant-Id': this.tenantId,
      'X-Actor': this.actor,
    };
  }

  /**
   * Makes a GET request with tenant headers.
   */
  get(path: string): request.Test {
    return request(this.app.getHttpServer()).get(path).set(this.getHeaders());
  }

  /**
   * Makes a POST request with tenant headers.
   */
  post(path: string): request.Test {
    return request(this.app.getHttpServer()).post(path).set(this.getHeaders());
  }

  /**
   * Makes a PATCH request with tenant headers.
   */
  patch(path: string): request.Test {
    return request(this.app.getHttpServer()).patch(path).set(this.getHeaders());
  }

  /**
   * Makes a PUT request with tenant headers.
   */
  put(path: string): request.Test {
    return request(this.app.getHttpServer()).put(path).set(this.getHeaders());
  }

  /**
   * Makes a DELETE request with tenant headers.
   */
  delete(path: string): request.Test {
    return request(this.app.getHttpServer())
      .delete(path)
      .set(this.getHeaders());
  }

  /**
   * Makes a request without tenant headers (for testing header validation).
   */
  getWithoutHeaders(path: string): request.Test {
    return request(this.app.getHttpServer()).get(path);
  }

  /**
   * Makes a request with custom headers.
   */
  getWithCustomHeaders(
    path: string,
    headers: Record<string, string>,
  ): request.Test {
    return request(this.app.getHttpServer()).get(path).set(headers);
  }

  /**
   * Makes a POST request without tenant headers.
   */
  postWithoutHeaders(path: string): request.Test {
    return request(this.app.getHttpServer()).post(path);
  }

  /**
   * Makes a POST request with custom headers.
   */
  postWithCustomHeaders(
    path: string,
    headers: Record<string, string>,
  ): request.Test {
    return request(this.app.getHttpServer()).post(path).set(headers);
  }
}

/**
 * API path builders for consistency.
 */
export const API_PATHS = {
  // Tasks
  tasks: '/api/maintenance/tasks',
  task: (taskId: string) => `/api/maintenance/tasks/${taskId}`,
  taskVehicles: (taskId: string) => `/api/maintenance/tasks/${taskId}/vehicles`,

  // Vehicle maintenance
  vehicleMaintenance: (vehicleId: number) =>
    `/api/vehicles/${vehicleId}/maintenance`,

  // Status transitions
  completeVehicle: (taskId: string, vehicleId: number) =>
    `/api/maintenance/tasks/${taskId}/vehicles/${vehicleId}/status/completed`,
  cancelVehicle: (taskId: string, vehicleId: number) =>
    `/api/maintenance/tasks/${taskId}/vehicles/${vehicleId}/status/cancelled`,
  rescheduleVehicle: (taskId: string, vehicleId: number) =>
    `/api/maintenance/tasks/${taskId}/vehicles/${vehicleId}/status/rescheduled`,

  // Corrections
  corrections: (taskId: string, vehicleId: number) =>
    `/api/maintenance/tasks/${taskId}/vehicles/${vehicleId}/corrections`,

  // Attachments
  attachments: (taskId: string, vehicleId: number) =>
    `/api/maintenance/tasks/${taskId}/vehicles/${vehicleId}/attachments`,

  // Reference data
  workshops: '/api/reference/workshops',
  workshop: (id: string) => `/api/reference/workshops/${id}`,
  reasons: '/api/reference/reasons',
  reason: (id: string) => `/api/reference/reasons/${id}`,

  // Reports
  maintenanceStatus: '/api/reports/maintenance-status',
  overduePreventive: '/api/reports/overdue-preventive',
  costSummary: '/api/reports/cost-summary',
  correctiveVsPreventive: '/api/reports/corrective-vs-preventive',

  // Swagger
  swagger: '/api/docs',

  // Uploads
  uploads: '/api/uploads',
};

/**
 * Helper to extract data from response.
 */
export function extractData<T>(response: HttpResponse): T {
  return response.body.data as T;
}

/**
 * Helper to extract error from response.
 */
export function extractError(response: HttpResponse): {
  statusCode: number;
  message: string | string[];
  error: string;
} {
  return response.body;
}
