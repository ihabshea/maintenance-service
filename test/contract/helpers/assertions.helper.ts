import { HttpResponse } from './http.helper';

/**
 * Custom assertion helpers for contract tests.
 */

/**
 * Asserts the response has the expected status code.
 */
export function assertStatus(
  response: HttpResponse,
  expectedStatus: number,
): void {
  expect(response.status).toBe(expectedStatus);
}

/**
 * Asserts the response contains a data property.
 */
export function assertHasData(response: HttpResponse): void {
  expect(response.body).toHaveProperty('data');
}

/**
 * Asserts the response data is an array.
 */
export function assertDataIsArray(response: HttpResponse): void {
  assertHasData(response);
  expect(Array.isArray(response.body.data)).toBe(true);
}

/**
 * Asserts the response data array has the expected length.
 */
export function assertDataArrayLength(
  response: HttpResponse,
  length: number,
): void {
  assertDataIsArray(response);
  expect(response.body.data.length).toBe(length);
}

/**
 * Asserts the response is a successful creation (201).
 */
export function assertCreated(response: HttpResponse): void {
  assertStatus(response, 201);
  assertHasData(response);
}

/**
 * Asserts the response is a successful retrieval (200).
 */
export function assertOk(response: HttpResponse): void {
  assertStatus(response, 200);
  assertHasData(response);
}

/**
 * Asserts the response is a bad request (400).
 */
export function assertBadRequest(response: HttpResponse): void {
  assertStatus(response, 400);
  expect(response.body).toHaveProperty('statusCode', 400);
  expect(response.body).toHaveProperty('message');
}

/**
 * Asserts the response is not found (404).
 */
export function assertNotFound(response: HttpResponse): void {
  assertStatus(response, 404);
  expect(response.body).toHaveProperty('statusCode', 404);
}

/**
 * Asserts the response is a conflict (409).
 */
export function assertConflict(response: HttpResponse): void {
  assertStatus(response, 409);
  expect(response.body).toHaveProperty('statusCode', 409);
}

/**
 * Asserts a field exists and has the expected value.
 */
export function assertDataField<T>(
  response: HttpResponse,
  field: string,
  expectedValue: T,
): void {
  assertHasData(response);
  expect(response.body.data).toHaveProperty(field, expectedValue);
}

/**
 * Asserts a nested field exists in the data.
 */
export function assertDataHasField(
  response: HttpResponse,
  field: string,
): void {
  assertHasData(response);
  expect(response.body.data).toHaveProperty(field);
}

/**
 * Asserts the response data contains all expected fields.
 */
export function assertDataHasFields(
  response: HttpResponse,
  fields: string[],
): void {
  assertHasData(response);
  fields.forEach((field) => {
    expect(response.body.data).toHaveProperty(field);
  });
}

/**
 * Asserts the response is a validation error with specific message.
 */
export function assertValidationError(
  response: HttpResponse,
  messageContains?: string,
): void {
  assertBadRequest(response);
  if (messageContains) {
    const messages = Array.isArray(response.body.message)
      ? response.body.message
      : [response.body.message];
    const found = messages.some((msg: string) =>
      msg.toLowerCase().includes(messageContains.toLowerCase()),
    );
    expect(found).toBe(true);
  }
}

/**
 * Asserts the task response has the correct structure.
 */
export function assertTaskStructure(response: HttpResponse): void {
  assertOk(response);
  const data = response.body.data;
  expect(data).toHaveProperty('id');
  expect(data).toHaveProperty('tenantId');
  expect(data).toHaveProperty('title');
  expect(data).toHaveProperty('maintenanceType');
}

/**
 * Asserts the task response includes vehicles.
 */
export function assertTaskHasVehicles(
  response: HttpResponse,
  count?: number,
): void {
  assertTaskStructure(response);
  expect(response.body.data).toHaveProperty('vehicles');
  expect(Array.isArray(response.body.data.vehicles)).toBe(true);
  if (count !== undefined) {
    expect(response.body.data.vehicles.length).toBe(count);
  }
}

/**
 * Asserts the task response includes jobs.
 */
export function assertTaskHasJobs(
  response: HttpResponse,
  count?: number,
): void {
  assertTaskStructure(response);
  expect(response.body.data).toHaveProperty('jobs');
  expect(Array.isArray(response.body.data.jobs)).toBe(true);
  if (count !== undefined) {
    expect(response.body.data.jobs.length).toBe(count);
  }
}

/**
 * Asserts a vehicle in the response has the expected status.
 */
export function assertVehicleStatus(
  response: HttpResponse,
  vehicleId: string,
  expectedStatus: 'open' | 'completed' | 'cancelled' | 'rescheduled',
): void {
  assertTaskHasVehicles(response);
  const vehicle = response.body.data.vehicles.find(
    (v: { vehicleId: string }) => v.vehicleId === vehicleId,
  );
  expect(vehicle).toBeDefined();
  expect(vehicle.status).toBe(expectedStatus);
}

/**
 * Asserts the workshop response has the correct structure.
 */
export function assertWorkshopStructure(data: any): void {
  expect(data).toHaveProperty('id');
  expect(data).toHaveProperty('scope');
  expect(data).toHaveProperty('name');
  expect(data).toHaveProperty('status');
}

/**
 * Asserts the reason response has the correct structure.
 */
export function assertReasonStructure(data: any): void {
  expect(data).toHaveProperty('id');
  expect(data).toHaveProperty('scope');
  expect(data).toHaveProperty('reasonType');
  expect(data).toHaveProperty('label');
  expect(data).toHaveProperty('status');
}

/**
 * Asserts the attachment response has the correct structure.
 */
export function assertAttachmentStructure(data: any): void {
  expect(data).toHaveProperty('id');
  expect(data).toHaveProperty('fileUrl');
  expect(data).toHaveProperty('fileType');
  expect(data).toHaveProperty('uploadedAt');
}

/**
 * Asserts overdue computation fields in vehicle.
 * Note: The API uses 'computed' instead of 'date_based' for the overdueComputation field.
 */
export function assertOverdueFields(
  vehicle: any,
  expectedOverdue: boolean | null,
  expectedComputation: 'computed' | 'insufficient_data' | 'not_applicable',
): void {
  expect(vehicle).toHaveProperty('overdue', expectedOverdue);
  expect(vehicle).toHaveProperty('overdueComputation', expectedComputation);
}
