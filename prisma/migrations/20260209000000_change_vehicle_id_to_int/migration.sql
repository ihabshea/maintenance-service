-- AlterColumn: Change vehicle_id from UUID to INTEGER

-- Drop foreign keys that reference composite keys containing vehicle_id
ALTER TABLE "maintenance_attachments" DROP CONSTRAINT "maintenance_attachments_tenant_id_task_id_vehicle_id_fkey";
ALTER TABLE "maintenance_task_vehicle_jobs" DROP CONSTRAINT "maintenance_task_vehicle_jobs_tenant_id_task_id_vehicle_id_fkey";

-- Drop composite primary keys that include vehicle_id
ALTER TABLE "maintenance_task_vehicle_jobs" DROP CONSTRAINT "maintenance_task_vehicle_jobs_pkey";
ALTER TABLE "maintenance_task_vehicles" DROP CONSTRAINT "maintenance_task_vehicles_pkey";

-- Drop indexes that include vehicle_id
DROP INDEX IF EXISTS "maintenance_task_vehicles_tenant_id_vehicle_id_idx";
DROP INDEX IF EXISTS "maintenance_attachments_tenant_id_task_id_vehicle_id_idx";

-- Alter vehicle_id columns from UUID to INTEGER
ALTER TABLE "maintenance_task_vehicles" ALTER COLUMN "vehicle_id" SET DATA TYPE INTEGER USING "vehicle_id"::text::integer;
ALTER TABLE "maintenance_task_vehicle_jobs" ALTER COLUMN "vehicle_id" SET DATA TYPE INTEGER USING "vehicle_id"::text::integer;
ALTER TABLE "maintenance_attachments" ALTER COLUMN "vehicle_id" SET DATA TYPE INTEGER USING "vehicle_id"::text::integer;

-- Recreate composite primary keys
ALTER TABLE "maintenance_task_vehicles" ADD CONSTRAINT "maintenance_task_vehicles_pkey" PRIMARY KEY ("tenant_id", "task_id", "vehicle_id");
ALTER TABLE "maintenance_task_vehicle_jobs" ADD CONSTRAINT "maintenance_task_vehicle_jobs_pkey" PRIMARY KEY ("tenant_id", "task_id", "vehicle_id", "job_code");

-- Recreate foreign keys
ALTER TABLE "maintenance_task_vehicle_jobs" ADD CONSTRAINT "maintenance_task_vehicle_jobs_tenant_id_task_id_vehicle_id_fkey" FOREIGN KEY ("tenant_id", "task_id", "vehicle_id") REFERENCES "maintenance_task_vehicles"("tenant_id", "task_id", "vehicle_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "maintenance_attachments" ADD CONSTRAINT "maintenance_attachments_tenant_id_task_id_vehicle_id_fkey" FOREIGN KEY ("tenant_id", "task_id", "vehicle_id") REFERENCES "maintenance_task_vehicles"("tenant_id", "task_id", "vehicle_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Recreate indexes
CREATE INDEX "maintenance_task_vehicles_tenant_id_vehicle_id_idx" ON "maintenance_task_vehicles"("tenant_id", "vehicle_id");
CREATE INDEX "maintenance_attachments_tenant_id_task_id_vehicle_id_idx" ON "maintenance_attachments"("tenant_id", "task_id", "vehicle_id");
