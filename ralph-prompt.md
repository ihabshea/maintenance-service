# Align maintenance-service with mock-maintenance API contract

You are iterating on ~/maintenance-service (a NestJS backend) to make its API responses and behavior match ~/mock-maintenance (an Express mock server) exactly.

## How to work

1. Pick ONE difference from the checklist below
2. Read the relevant mock source file to understand the expected behavior
3. Read the corresponding service source file
4. Make the fix in the service
5. Run `npx tsc --noEmit 2>&1 | grep -v "test/"` to type-check (ignore test/ errors)
6. Test with curl against https://maintenance-service-production.up.railway.app/api/ using header `X-Tenant-Id: 1001`
7. Commit and push: `git add -A && git commit -m "<description>" && git push origin main && git push github main`
8. Mark the item done and move to the next

## Checklist of remaining differences

Compare ~/mock-maintenance/src/ against ~/maintenance-service/src/ for each:

- [ ] **GET /api/maintenance/tasks response shape**: Verify the deployed response at /api/maintenance/tasks matches the mock's buildTaskResponse (tasks.ts lines 70-98). No extra fields like `createdBy`, `tenantId`, raw Prisma relations. Only explicit fields.
- [ ] **GET /api/maintenance/tasks/:taskId response shape**: Same — verify single task response matches mock exactly.
- [ ] **POST /api/maintenance/tasks response shape**: Should return full task with vehicles/checklist/completion, not flat Prisma record.
- [ ] **Vehicle objects inside task responses**: Should use buildVehicleResponse shape (id, vehicleId, status, all nullable fields with ?? null, overdue, overdueComputation, jobs array, createdAt, updatedAt). No tenantId, taskId, costCurrency when no cost, raw vehicleJobs.
- [ ] **POST /api/maintenance/tasks/:taskId/vehicles response**: Returns array of created vehicle objects (matching buildVehicleResponse shape).
- [ ] **PATCH /api/maintenance/tasks/:taskId/vehicles/:vehicleId/status/completed response**: Returns single vehicle object (buildVehicleResponse shape).
- [ ] **PATCH /api/maintenance/tasks/:taskId/vehicles/:vehicleId/status/cancelled response**: Same.
- [ ] **PATCH /api/maintenance/tasks/:taskId/vehicles/:vehicleId/status/rescheduled response**: Same.
- [ ] **POST /api/maintenance/tasks/:taskId/vehicles/:vehicleId/corrections response**: Returns `{ success: true, correctionId: <uuid>, vehicle: <buildVehicleResponse> }`.
- [ ] **GET /api/vehicles/:vehicleId/maintenance response**: Compare mock's vehicles.ts response (lines 50-77) with service. Should have taskId, taskTitle, maintenanceType, explicit fields.
- [ ] **POST /api/vehicles/maintenance-status response**: Compare mock's tasks.ts (lines 624-674) with service response.
- [ ] **GET /api/reference/workshops response**: Mock returns flat array (wrapped by middleware to `{ data: [...] }`). Service returns paginated `{ data: [...], pagination: {...} }`. These should match. If dashboard expects no pagination, remove it from service.
- [ ] **GET /api/reference/reasons response**: Same as workshops.
- [ ] **GET /api/maintenance/tasks/:taskId/vehicles/:vehicleId/attachments response**: Mock returns flat array. Service returns paginated.
- [ ] **POST /api/uploads**: Mock accepts both multipart and JSON body. Service only accepts multipart. Add JSON body fallback to match mock.
- [ ] **Attachment fileUrl validation**: Mock accepts any non-empty string. Service requires valid URL with protocol (@IsUrl). Relax to @IsString.
- [ ] **Attachment fileName/contentType**: Mock requires both. Service has them optional. Make them required.
- [ ] **All audit action values**: Verify every auditService.log call uses mock's action names: 'create', 'update', 'deleted', 'complete', 'cancel', 'reschedule', 'correction'.
- [ ] **Error messages for status transitions**: Mock says "Vehicle is already {status}. Use corrections endpoint to modify." — verify service matches.

## Key files to compare

**Mock:**
- ~/mock-maintenance/src/routes/tasks.ts (buildVehicleResponse, buildTaskResponse, all handlers)
- ~/mock-maintenance/src/routes/vehicles.ts
- ~/mock-maintenance/src/routes/reference.ts
- ~/mock-maintenance/src/routes/uploads.ts
- ~/mock-maintenance/src/routes/audit.ts
- ~/mock-maintenance/src/routes/reports.ts
- ~/mock-maintenance/src/middleware/validate.ts
- ~/mock-maintenance/src/store/db.ts

**Service:**
- ~/maintenance-service/src/modules/tasks/tasks.controller.ts
- ~/maintenance-service/src/modules/tasks/tasks.service.ts
- ~/maintenance-service/src/modules/tasks/dto/*.ts
- ~/maintenance-service/src/modules/reference/reference.controller.ts
- ~/maintenance-service/src/modules/reference/reference.service.ts
- ~/maintenance-service/src/modules/attachments/attachments.controller.ts
- ~/maintenance-service/src/modules/attachments/attachments.service.ts
- ~/maintenance-service/src/modules/uploads/uploads.controller.ts
- ~/maintenance-service/src/modules/uploads/uploads.service.ts
- ~/maintenance-service/src/modules/audit/audit.service.ts
- ~/maintenance-service/src/modules/reports/reports.service.ts

## Rules

- Always type-check before committing
- Never modify test/ files
- Never modify the mock — only the service
- Push to both `origin` and `github` remotes
- No Claude attributions in commits
- Test against the live Railway deployment after each push when possible

Output <promise>DONE</promise> when all checklist items are verified and fixed.
