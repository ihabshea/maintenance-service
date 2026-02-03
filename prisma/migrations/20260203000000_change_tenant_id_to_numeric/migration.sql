-- AlterColumn: Change tenant_id from UUID to TEXT for numeric tenant IDs

-- Drop dependent indexes first
DROP INDEX IF EXISTS "maintenance_tasks_tenant_id_idx";
DROP INDEX IF EXISTS "maintenance_tasks_tenant_id_maintenance_type_idx";
DROP INDEX IF EXISTS "maintenance_task_vehicles_tenant_id_vehicle_id_idx";
DROP INDEX IF EXISTS "maintenance_task_vehicles_tenant_id_status_idx";
DROP INDEX IF EXISTS "maintenance_attachments_tenant_id_task_id_vehicle_id_idx";
DROP INDEX IF EXISTS "maintenance_audit_log_tenant_id_entity_type_entity_id_idx";
DROP INDEX IF EXISTS "maintenance_audit_log_tenant_id_timestamp_idx";
DROP INDEX IF EXISTS "workshops_tenant_id_idx";
DROP INDEX IF EXISTS "reasons_tenant_id_idx";
DROP INDEX IF EXISTS "uploads_tenant_id_claimed_at_created_at_idx";
DROP INDEX IF EXISTS "uploads_tenant_id_file_url_idx";

-- Drop foreign keys that reference composite primary keys containing tenant_id
ALTER TABLE "maintenance_attachments" DROP CONSTRAINT "maintenance_attachments_tenant_id_task_id_vehicle_id_fkey";
ALTER TABLE "maintenance_task_vehicle_jobs" DROP CONSTRAINT "maintenance_task_vehicle_jobs_tenant_id_task_id_vehicle_id_fkey";
ALTER TABLE "maintenance_task_vehicle_jobs" DROP CONSTRAINT "maintenance_task_vehicle_jobs_tenant_id_task_id_job_code_fkey";

-- Drop composite primary keys that include tenant_id
ALTER TABLE "maintenance_task_vehicle_jobs" DROP CONSTRAINT "maintenance_task_vehicle_jobs_pkey";
ALTER TABLE "maintenance_task_vehicles" DROP CONSTRAINT "maintenance_task_vehicles_pkey";
ALTER TABLE "maintenance_task_jobs" DROP CONSTRAINT "maintenance_task_jobs_pkey";

-- Alter tenant_id columns from UUID to TEXT
ALTER TABLE "maintenance_tasks" ALTER COLUMN "tenant_id" SET DATA TYPE TEXT;
ALTER TABLE "maintenance_task_vehicles" ALTER COLUMN "tenant_id" SET DATA TYPE TEXT;
ALTER TABLE "maintenance_task_jobs" ALTER COLUMN "tenant_id" SET DATA TYPE TEXT;
ALTER TABLE "maintenance_task_vehicle_jobs" ALTER COLUMN "tenant_id" SET DATA TYPE TEXT;
ALTER TABLE "workshops" ALTER COLUMN "tenant_id" SET DATA TYPE TEXT;
ALTER TABLE "reasons" ALTER COLUMN "tenant_id" SET DATA TYPE TEXT;
ALTER TABLE "maintenance_attachments" ALTER COLUMN "tenant_id" SET DATA TYPE TEXT;
ALTER TABLE "maintenance_audit_log" ALTER COLUMN "tenant_id" SET DATA TYPE TEXT;
ALTER TABLE "uploads" ALTER COLUMN "tenant_id" SET DATA TYPE TEXT;

-- Recreate composite primary keys
ALTER TABLE "maintenance_task_vehicles" ADD CONSTRAINT "maintenance_task_vehicles_pkey" PRIMARY KEY ("tenant_id", "task_id", "vehicle_id");
ALTER TABLE "maintenance_task_jobs" ADD CONSTRAINT "maintenance_task_jobs_pkey" PRIMARY KEY ("tenant_id", "task_id", "job_code");
ALTER TABLE "maintenance_task_vehicle_jobs" ADD CONSTRAINT "maintenance_task_vehicle_jobs_pkey" PRIMARY KEY ("tenant_id", "task_id", "vehicle_id", "job_code");

-- Recreate foreign keys
ALTER TABLE "maintenance_task_vehicle_jobs" ADD CONSTRAINT "maintenance_task_vehicle_jobs_tenant_id_task_id_job_code_fkey" FOREIGN KEY ("tenant_id", "task_id", "job_code") REFERENCES "maintenance_task_jobs"("tenant_id", "task_id", "job_code") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "maintenance_task_vehicle_jobs" ADD CONSTRAINT "maintenance_task_vehicle_jobs_tenant_id_task_id_vehicle_id_fkey" FOREIGN KEY ("tenant_id", "task_id", "vehicle_id") REFERENCES "maintenance_task_vehicles"("tenant_id", "task_id", "vehicle_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "maintenance_attachments" ADD CONSTRAINT "maintenance_attachments_tenant_id_task_id_vehicle_id_fkey" FOREIGN KEY ("tenant_id", "task_id", "vehicle_id") REFERENCES "maintenance_task_vehicles"("tenant_id", "task_id", "vehicle_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Recreate indexes
CREATE INDEX "maintenance_tasks_tenant_id_idx" ON "maintenance_tasks"("tenant_id");
CREATE INDEX "maintenance_tasks_tenant_id_maintenance_type_idx" ON "maintenance_tasks"("tenant_id", "maintenance_type");
CREATE INDEX "maintenance_task_vehicles_tenant_id_vehicle_id_idx" ON "maintenance_task_vehicles"("tenant_id", "vehicle_id");
CREATE INDEX "maintenance_task_vehicles_tenant_id_status_idx" ON "maintenance_task_vehicles"("tenant_id", "status");
CREATE INDEX "maintenance_attachments_tenant_id_task_id_vehicle_id_idx" ON "maintenance_attachments"("tenant_id", "task_id", "vehicle_id");
CREATE INDEX "maintenance_audit_log_tenant_id_entity_type_entity_id_idx" ON "maintenance_audit_log"("tenant_id", "entity_type", "entity_id");
CREATE INDEX "maintenance_audit_log_tenant_id_timestamp_idx" ON "maintenance_audit_log"("tenant_id", "timestamp");
CREATE INDEX "workshops_tenant_id_idx" ON "workshops"("tenant_id");
CREATE INDEX "reasons_tenant_id_idx" ON "reasons"("tenant_id");
CREATE INDEX "uploads_tenant_id_claimed_at_created_at_idx" ON "uploads"("tenant_id", "claimed_at", "created_at");
CREATE INDEX "uploads_tenant_id_file_url_idx" ON "uploads"("tenant_id", "file_url");
