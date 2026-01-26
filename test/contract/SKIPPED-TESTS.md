# Skipped Contract Tests

This document tracks all skipped tests in the contract test suite and the reasons for skipping.

**Total Skipped: 10**

## Summary by Category

| Category | Count | Status |
|----------|-------|--------|
| API Validation Bugs | 5 | Awaiting fix - returns 500 instead of 400 |
| Unimplemented Audit Logging | 2 | Feature not yet implemented |
| Swagger Tests | 3 | Requires production runtime |

---

## API Validation Bugs (5 tests)

These tests are skipped because the API returns HTTP 500 (Internal Server Error) instead of the expected HTTP 400 (Bad Request) when validation fails. This indicates missing DTO validation decorators or improper error handling.

### 1. complete-vehicle.spec.ts - Missing workshop validation

**File:** `specs/complete-vehicle.spec.ts:142`
**Test:** `should reject missing workshop - API returns 500, expected 400`
**Issue:** When `workshop` object is missing from CompleteVehicleDto, API throws unhandled error
**Expected:** Return 400 Bad Request with validation message
**Fix Required:** Add `@IsNotEmpty()` or `@ValidateNested()` decorator to `workshop` field

### 2. complete-vehicle.spec.ts - Missing cost validation

**File:** `specs/complete-vehicle.spec.ts:151`
**Test:** `should reject missing cost - API returns 500, expected 400`
**Issue:** When `cost` object is missing from CompleteVehicleDto, API throws unhandled error
**Expected:** Return 400 Bad Request with validation message
**Fix Required:** Add `@IsNotEmpty()` or `@ValidateNested()` decorator to `cost` field

### 3. cancel-vehicle.spec.ts - Missing cancellationReason validation

**File:** `specs/cancel-vehicle.spec.ts:112`
**Test:** `should reject missing cancellationReason - API returns 500, expected 400`
**Issue:** When `cancellationReason` object is missing from CancelVehicleDto, API throws unhandled error
**Expected:** Return 400 Bad Request with validation message
**Fix Required:** Add `@IsNotEmpty()` or `@ValidateNested()` decorator to `cancellationReason` field

### 4. corrections.spec.ts - Missing patch validation

**File:** `specs/corrections.spec.ts:168`
**Test:** `should reject missing patch field - API returns 500, expected 400`
**Issue:** When `patch` object is missing from CorrectionDto, API throws unhandled error
**Expected:** Return 400 Bad Request with validation message
**Fix Required:** Add `@IsNotEmpty()` or `@ValidateNested()` decorator to `patch` field

### 5. workshops.spec.ts - Missing name validation

**File:** `specs/workshops.spec.ts:156`
**Test:** `should reject missing name - API returns 500, expected 400`
**Issue:** When `name` field is missing from CreateWorkshopDto, API throws unhandled error
**Expected:** Return 400 Bad Request with validation message
**Fix Required:** Add `@IsNotEmpty()` decorator to `name` field

---

## Unimplemented Audit Logging (2 tests)

These tests verify audit log creation but the audit logging feature is not yet implemented for these operations.

### 6. create-task.spec.ts - Task creation audit

**File:** `specs/create-task.spec.ts:160`
**Test:** `should create audit log entry with action=create - audit logging not yet implemented`
**Issue:** Audit logging for task creation is not implemented
**Expected:** Create MaintenanceAuditLog entry with action='create'
**Fix Required:** Add audit logging call in TasksService.create()

### 7. add-vehicles.spec.ts - Vehicle addition audit

**File:** `specs/add-vehicles.spec.ts:162`
**Test:** `should create audit log entry for each vehicle added - audit logging not yet implemented`
**Issue:** Audit logging for adding vehicles to task is not implemented
**Expected:** Create MaintenanceAuditLog entry for each vehicle added
**Fix Required:** Add audit logging call in TasksService.addVehicles()

---

## Swagger Tests (3 tests)

These tests verify Swagger/OpenAPI documentation availability but are skipped because Swagger is configured at application bootstrap (`main.ts`), not in the NestJS testing module.

### 8. swagger.spec.ts - Swagger UI availability

**File:** `specs/swagger.spec.ts:15`
**Test:** `should return 200 or redirect for Swagger UI (requires production runtime)`
**Issue:** Swagger setup happens in main.ts before app.init()
**Verification:** Manual - `curl -I http://localhost:3000/api/docs`

### 9. swagger.spec.ts - Swagger public access

**File:** `specs/swagger.spec.ts:21`
**Test:** `should not require authentication headers (requires production runtime)`
**Issue:** Cannot verify header requirements without production runtime
**Verification:** Manual - Swagger should work without X-Tenant-Id header

### 10. swagger.spec.ts - OpenAPI JSON spec

**File:** `specs/swagger.spec.ts:27`
**Test:** `should return OpenAPI JSON specification (requires production runtime)`
**Issue:** OpenAPI JSON endpoint only available in production runtime
**Verification:** Manual - `curl http://localhost:3000/api/docs-json`

---

## Re-enabling Tests

When fixes are applied:

1. Remove the `.skip` from the test
2. Run the specific test file to verify: `yarn test:contract -- --testNamePattern="test name"`
3. Update this document to remove the entry
4. Add entry to change-log.md documenting the fix
