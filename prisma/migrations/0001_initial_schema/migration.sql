-- CreateEnum
CREATE TYPE "MaintenanceType" AS ENUM ('preventive', 'corrective');

-- CreateEnum
CREATE TYPE "TriggerMode" AS ENUM ('mileage', 'time', 'both');

-- CreateEnum
CREATE TYPE "TaskVehicleStatus" AS ENUM ('open', 'completed', 'cancelled', 'rescheduled');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('pending', 'done', 'skipped');

-- CreateEnum
CREATE TYPE "ReferenceScope" AS ENUM ('system', 'tenant');

-- CreateEnum
CREATE TYPE "ReferenceStatus" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "ReasonType" AS ENUM ('cancellation');

-- CreateEnum
CREATE TYPE "AuditEntityType" AS ENUM ('task', 'task_vehicle', 'workshop', 'reason', 'attachment');

-- CreateTable
CREATE TABLE "maintenance_tasks" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "maintenance_type" "MaintenanceType" NOT NULL,
    "trigger_mode" "TriggerMode",
    "trigger_km" INTEGER,
    "trigger_date" DATE,
    "remind_before_km" INTEGER,
    "remind_before_days" INTEGER,
    "notes" TEXT,
    "created_by" TEXT NOT NULL,
    "source_group_id" UUID,
    "selection_context" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintenance_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_task_vehicles" (
    "tenant_id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "status" "TaskVehicleStatus" NOT NULL DEFAULT 'open',
    "due_odometer_km" INTEGER,
    "due_date" DATE,
    "actual_odometer_km" INTEGER,
    "completion_date" DATE,
    "workshop_id" UUID,
    "workshop_custom" TEXT,
    "cost_amount" DECIMAL(12,2),
    "cost_currency" TEXT NOT NULL DEFAULT 'EGP',
    "cancellation_date" DATE,
    "cancellation_reason_id" UUID,
    "cancellation_reason_custom" TEXT,
    "reschedule_original_due_date" DATE,
    "reschedule_new_due_date" DATE,
    "reschedule_reason" TEXT,
    "reschedule_odometer_km" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintenance_task_vehicles_pkey" PRIMARY KEY ("tenant_id","task_id","vehicle_id")
);

-- CreateTable
CREATE TABLE "maintenance_task_jobs" (
    "tenant_id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "job_code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,

    CONSTRAINT "maintenance_task_jobs_pkey" PRIMARY KEY ("tenant_id","task_id","job_code")
);

-- CreateTable
CREATE TABLE "maintenance_task_vehicle_jobs" (
    "tenant_id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "job_code" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'pending',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintenance_task_vehicle_jobs_pkey" PRIMARY KEY ("tenant_id","task_id","vehicle_id","job_code")
);

-- CreateTable
CREATE TABLE "workshops" (
    "id" UUID NOT NULL,
    "scope" "ReferenceScope" NOT NULL,
    "tenant_id" UUID,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "status" "ReferenceStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workshops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reasons" (
    "id" UUID NOT NULL,
    "scope" "ReferenceScope" NOT NULL,
    "tenant_id" UUID,
    "reason_type" "ReasonType" NOT NULL,
    "label" TEXT NOT NULL,
    "status" "ReferenceStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_attachments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_type" TEXT NOT NULL,
    "file_name" TEXT,
    "content_type" TEXT,
    "uploaded_by" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "maintenance_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_audit_log" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "entity_type" "AuditEntityType" NOT NULL,
    "entity_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "previous_value" JSONB,
    "new_value" JSONB,

    CONSTRAINT "maintenance_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "maintenance_tasks_tenant_id_idx" ON "maintenance_tasks"("tenant_id");

-- CreateIndex
CREATE INDEX "maintenance_tasks_tenant_id_maintenance_type_idx" ON "maintenance_tasks"("tenant_id", "maintenance_type");

-- CreateIndex
CREATE INDEX "maintenance_task_vehicles_tenant_id_vehicle_id_idx" ON "maintenance_task_vehicles"("tenant_id", "vehicle_id");

-- CreateIndex
CREATE INDEX "maintenance_task_vehicles_tenant_id_status_idx" ON "maintenance_task_vehicles"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "workshops_tenant_id_idx" ON "workshops"("tenant_id");

-- CreateIndex
CREATE INDEX "workshops_scope_idx" ON "workshops"("scope");

-- CreateIndex
CREATE INDEX "reasons_tenant_id_idx" ON "reasons"("tenant_id");

-- CreateIndex
CREATE INDEX "reasons_scope_reason_type_idx" ON "reasons"("scope", "reason_type");

-- CreateIndex
CREATE INDEX "maintenance_attachments_tenant_id_task_id_vehicle_id_idx" ON "maintenance_attachments"("tenant_id", "task_id", "vehicle_id");

-- CreateIndex
CREATE INDEX "maintenance_audit_log_tenant_id_entity_type_entity_id_idx" ON "maintenance_audit_log"("tenant_id", "entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "maintenance_audit_log_tenant_id_timestamp_idx" ON "maintenance_audit_log"("tenant_id", "timestamp");

-- AddForeignKey
ALTER TABLE "maintenance_task_vehicles" ADD CONSTRAINT "maintenance_task_vehicles_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "maintenance_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_task_vehicles" ADD CONSTRAINT "maintenance_task_vehicles_workshop_id_fkey" FOREIGN KEY ("workshop_id") REFERENCES "workshops"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_task_vehicles" ADD CONSTRAINT "maintenance_task_vehicles_cancellation_reason_id_fkey" FOREIGN KEY ("cancellation_reason_id") REFERENCES "reasons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_task_jobs" ADD CONSTRAINT "maintenance_task_jobs_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "maintenance_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_task_vehicle_jobs" ADD CONSTRAINT "maintenance_task_vehicle_jobs_tenant_id_task_id_job_code_fkey" FOREIGN KEY ("tenant_id", "task_id", "job_code") REFERENCES "maintenance_task_jobs"("tenant_id", "task_id", "job_code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_task_vehicle_jobs" ADD CONSTRAINT "maintenance_task_vehicle_jobs_tenant_id_task_id_vehicle_id_fkey" FOREIGN KEY ("tenant_id", "task_id", "vehicle_id") REFERENCES "maintenance_task_vehicles"("tenant_id", "task_id", "vehicle_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_attachments" ADD CONSTRAINT "maintenance_attachments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "maintenance_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_attachments" ADD CONSTRAINT "maintenance_attachments_tenant_id_task_id_vehicle_id_fkey" FOREIGN KEY ("tenant_id", "task_id", "vehicle_id") REFERENCES "maintenance_task_vehicles"("tenant_id", "task_id", "vehicle_id") ON DELETE CASCADE ON UPDATE CASCADE;

