# Vehicle Maintenance Service

A NestJS microservice for managing vehicle maintenance tasks, supporting preventive and corrective maintenance with multi-tenant architecture.

## Features

- Create and manage maintenance tasks with vehicles and checklists
- Status transitions: open, completed, cancelled, rescheduled
- Corrections endpoint for modifying finalized records
- Reference data management (workshops and cancellation reasons)
- File uploads to MinIO object storage with automatic cleanup
- File attachment metadata storage
- Complete audit logging
- Multi-tenant data isolation

## Quick Start

```bash
# 1. Install dependencies
yarn install

# 2. Start infrastructure (PostgreSQL on 5434, Redis on 6381, MinIO on 9000/9001)
docker-compose up -d

# 3. Run migrations and seed data
yarn prisma:migrate:dev && yarn prisma:seed

# 4. Start the service
yarn start:dev

# Service runs at http://localhost:3000
# Swagger docs at http://localhost:3000/api/docs
# MinIO console at http://localhost:9001 (minioadmin / minioadmin123)
```

## Prerequisites

- Node.js 20+
- Docker and Docker Compose
- PostgreSQL 15+ (provided via Docker)
- Redis 7+ (optional, provided via Docker)
- MinIO (provided via Docker, for file uploads)

## Available Scripts

### Development

| Script | Description |
|--------|-------------|
| `yarn start:dev` | Start with hot-reload for development |
| `yarn start:debug` | Start with debugger attached |
| `yarn start:prod` | Start production build |
| `yarn build` | Build the application |

### Testing

| Script | Description |
|--------|-------------|
| `yarn test` | Run unit tests |
| `yarn test:e2e` | Run end-to-end tests |
| `yarn test:cov` | Run tests with coverage report |
| `yarn test:contract` | Run contract tests (API vs documentation) |
| `yarn test:contract:report` | Generate contract test reports |

### Database

| Script | Description |
|--------|-------------|
| `yarn prisma:migrate:dev` | Create and apply migrations (dev) |
| `yarn prisma:migrate:deploy` | Apply migrations (production) |
| `yarn prisma:seed` | Seed reference data |
| `yarn db:reset` | Reset database (drop, migrate, seed) |
| `yarn prisma:studio` | Open Prisma Studio GUI |

## Local Setup

### 1. Clone and install dependencies

```bash
yarn install
```

### 2. Start infrastructure

```bash
docker-compose up -d
```

This starts:
- PostgreSQL on port 5434
- Redis on port 6381
- MinIO on ports 9000 (API) and 9001 (Console)

### 3. Configure environment

```bash
cp .env.example .env
```

Default `.env` contents:
```
DATABASE_URL="postgresql://postgres:postgres@localhost:5434/maintenance_db?schema=public"
REDIS_HOST=localhost
REDIS_PORT=6381
PORT=3000
NODE_ENV=development

# MinIO Object Storage
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin123
MINIO_BUCKET_NAME=maintenance-uploads

# Upload Settings
UPLOAD_MAX_FILE_SIZE_MB=10
UPLOAD_RETENTION_HOURS=24
```

### 4. Run migrations

```bash
npm run prisma:migrate:dev
```

### 5. Seed reference data

```bash
npm run prisma:seed
```

### 6. Start the service

```bash
npm run start:dev
```

The service runs on http://localhost:3000

## Tenant ID

All requests require the `X-Tenant-Id` header with a valid numeric tenant ID. The gateway is expected to provide this header after authentication.

Example:
```
X-Tenant-Id: 11111111-1111-1111-1111-111111111111
```

Optionally, provide `X-Actor` header to identify the user making the request (defaults to "system").

## API Endpoints

Base path: `/api`

### Maintenance Tasks

#### Create Task
```bash
curl -X POST http://localhost:3000/api/maintenance/tasks \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: 11111111-1111-1111-1111-111111111111" \
  -H "X-Actor: user@example.com" \
  -d '{
    "title": "Oil Change",
    "maintenanceType": "preventive",
    "triggerMode": "mileage",
    "triggerKm": 5000,
    "vehicles": [
      {
        "vehicleId": "22222222-2222-2222-2222-222222222222",
        "dueOdometerKm": 50000,
        "dueDate": "2025-06-01"
      }
    ],
    "checklist": [
      { "jobCode": "OIL001", "label": "Drain old oil", "sortOrder": 1 },
      { "jobCode": "OIL002", "label": "Replace filter", "sortOrder": 2 },
      { "jobCode": "OIL003", "label": "Add new oil", "sortOrder": 3 }
    ]
  }'
```

#### Get Task
```bash
curl http://localhost:3000/api/maintenance/tasks/{taskId} \
  -H "X-Tenant-Id: 11111111-1111-1111-1111-111111111111"
```

#### Add Vehicles to Task
```bash
curl -X POST http://localhost:3000/api/maintenance/tasks/{taskId}/vehicles \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: 11111111-1111-1111-1111-111111111111" \
  -d '{
    "vehicles": [
      { "vehicleId": "33333333-3333-3333-3333-333333333333", "dueOdometerKm": 60000 }
    ]
  }'
```

#### Get Vehicle Maintenance History
```bash
curl "http://localhost:3000/api/vehicles/{vehicleId}/maintenance?maintenanceType=preventive&status=open" \
  -H "X-Tenant-Id: 11111111-1111-1111-1111-111111111111"
```

### Status Transitions

#### Complete Vehicle
```bash
curl -X PATCH http://localhost:3000/api/maintenance/tasks/{taskId}/vehicles/{vehicleId}/status/completed \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: 11111111-1111-1111-1111-111111111111" \
  -d '{
    "completionDate": "2025-01-15",
    "actualOdometerKm": 50500,
    "workshop": {
      "mode": "master",
      "workshopId": "00000000-0000-0000-0000-000000000001"
    },
    "cost": { "amount": 150, "currency": "EGP" },
    "jobs": [
      { "jobCode": "OIL001", "status": "done" },
      { "jobCode": "OIL002", "status": "done" },
      { "jobCode": "OIL003", "status": "done" }
    ]
  }'
```

#### Cancel Vehicle
```bash
curl -X PATCH http://localhost:3000/api/maintenance/tasks/{taskId}/vehicles/{vehicleId}/status/cancelled \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: 11111111-1111-1111-1111-111111111111" \
  -d '{
    "date": "2025-01-15",
    "actualOdometerKm": 49000,
    "cancellationReason": {
      "mode": "master",
      "reasonId": "00000000-0000-0000-0000-000000000101"
    }
  }'
```

#### Reschedule Vehicle
```bash
curl -X PATCH http://localhost:3000/api/maintenance/tasks/{taskId}/vehicles/{vehicleId}/status/rescheduled \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: 11111111-1111-1111-1111-111111111111" \
  -d '{
    "originalDate": "2025-01-15",
    "newScheduledDate": "2025-02-15",
    "rescheduleOdometerKm": 48000,
    "reason": "Parts not available"
  }'
```

### Corrections

Apply corrections to completed, cancelled, or rescheduled records:

```bash
curl -X POST http://localhost:3000/api/maintenance/tasks/{taskId}/vehicles/{vehicleId}/corrections \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: 11111111-1111-1111-1111-111111111111" \
  -d '{
    "correctionReason": "Cost was incorrectly recorded",
    "patch": {
      "costAmount": 200
    }
  }'
```

### Reference Data

#### List Workshops
```bash
curl http://localhost:3000/api/reference/workshops \
  -H "X-Tenant-Id: 11111111-1111-1111-1111-111111111111"
```

#### Create Workshop
```bash
curl -X POST http://localhost:3000/api/reference/workshops \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: 11111111-1111-1111-1111-111111111111" \
  -d '{
    "name": "My Workshop",
    "location": "Cairo, Egypt"
  }'
```

#### List Reasons
```bash
curl "http://localhost:3000/api/reference/reasons?type=cancellation" \
  -H "X-Tenant-Id: 11111111-1111-1111-1111-111111111111"
```

#### Create Reason
```bash
curl -X POST http://localhost:3000/api/reference/reasons \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: 11111111-1111-1111-1111-111111111111" \
  -d '{
    "reasonType": "cancellation",
    "label": "Budget constraints"
  }'
```

### File Uploads

#### Upload File
Upload a file to MinIO object storage. Returns a URL that can be used when creating attachments.
```bash
curl -X POST http://localhost:3000/api/uploads \
  -H "X-Tenant-Id: 11111111-1111-1111-1111-111111111111" \
  -H "X-Actor: user@example.com" \
  -F "file=@/path/to/document.pdf"
```

Response:
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "fileUrl": "http://localhost:9000/maintenance-uploads/11111111-1111-1111-1111-111111111111/550e8400-document.pdf",
    "fileName": "document.pdf",
    "contentType": "application/pdf",
    "fileSize": 12345,
    "createdAt": "2025-01-15T10:30:00Z"
  }
}
```

**Note:** Uploaded files are automatically cleaned up after 24 hours (configurable via `UPLOAD_RETENTION_HOURS`) unless they are "claimed" by creating an attachment that references the file URL.

### Attachments

#### Create Attachment
Create an attachment metadata record. If the `fileUrl` was uploaded via `/api/uploads`, it will be marked as "claimed" and won't be deleted by the cleanup job.
```bash
curl -X POST http://localhost:3000/api/maintenance/tasks/{taskId}/vehicles/{vehicleId}/attachments \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: 11111111-1111-1111-1111-111111111111" \
  -d '{
    "fileUrl": "http://localhost:9000/maintenance-uploads/11111111-1111-1111-1111-111111111111/550e8400-document.pdf",
    "fileType": "receipt",
    "fileName": "invoice-123.pdf",
    "contentType": "application/pdf"
  }'
```

#### List Attachments
```bash
curl http://localhost:3000/api/maintenance/tasks/{taskId}/vehicles/{vehicleId}/attachments \
  -H "X-Tenant-Id: 11111111-1111-1111-1111-111111111111"
```

## Migrations

### Create a new migration
```bash
npm run prisma:migrate:dev -- --name migration_name
```

### Apply migrations (production)
```bash
npm run prisma:migrate:deploy
```

### Reset database
```bash
npm run db:reset
```

## Testing

### Unit tests
```bash
npm run test
```

### E2E tests
```bash
npm run test:e2e
```

### Coverage
```bash
npm run test:cov
```

## Swagger Documentation

Swagger UI is available at: http://localhost:3000/api/docs

## Overdue Computation

For preventive maintenance tasks with status "open":
- If `dueDate` exists, overdue is computed by comparing to today
- If only `dueOdometerKm` exists without current odometer data, `overdue` returns `null` with `overdueComputation: "insufficient_data"`
- For corrective tasks or non-open statuses, `overdueComputation: "not_applicable"`

The service does not call external odometer services. Current odometer should be provided by upstream if needed.

## Limitations and Boundaries

1. **No authentication/RBAC**: The service assumes the gateway handles authentication and provides tenant context via headers.

2. **File storage via MinIO**: File uploads are stored in MinIO object storage. Unclaimed uploads (not attached to a record) are automatically deleted after 24 hours.

3. **No external integrations**: The service does not call external APIs. Odometer values are snapshots provided during operations.

4. **No scheduling/notifications**: Rescheduling stores data only. External schedulers should handle reminders and follow-up task creation.

5. **No message brokers**: All communication is REST-based. No events, webhooks, or message queues.

6. **Immutability**: Once a vehicle execution is completed/cancelled/rescheduled, regular status endpoints reject changes. Use the corrections endpoint for modifications.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| DATABASE_URL | PostgreSQL connection string | (required) |
| REDIS_HOST | Redis host | localhost |
| REDIS_PORT | Redis port | 6379 |
| PORT | Application port | 3000 |
| NODE_ENV | Environment mode | development |
| MINIO_ENDPOINT | MinIO server hostname | localhost |
| MINIO_PORT | MinIO API port | 9000 |
| MINIO_USE_SSL | Use HTTPS for MinIO | false |
| MINIO_ACCESS_KEY | MinIO access key | minioadmin |
| MINIO_SECRET_KEY | MinIO secret key | minioadmin123 |
| MINIO_BUCKET_NAME | Bucket for uploads | maintenance-uploads |
| UPLOAD_MAX_FILE_SIZE_MB | Max upload size in MB | 10 |
| UPLOAD_RETENTION_HOURS | Hours before unclaimed uploads are deleted | 24 |

## Project Structure

```
src/
  common/
    decorators/     # @TenantId, @Actor, @SkipTenantCheck
    filters/        # HTTP exception filter
    guards/         # Tenant guard
    interceptors/   # Response transform interceptor
  modules/
    tasks/          # Maintenance tasks, vehicles, status transitions
    reference/      # Workshops, reasons
    attachments/    # Attachment metadata
    uploads/        # File uploads to MinIO with automatic cleanup
    audit/          # Audit logging
  prisma/           # Prisma service
prisma/
  schema.prisma     # Database schema
  seed.ts           # Seed script
test/               # E2E tests
```
