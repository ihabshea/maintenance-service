-- AlterEnum
ALTER TYPE "ReasonType" ADD VALUE 'rescheduling';

-- AlterTable: replace reschedule_reason text with reschedule_reason_id FK + reschedule_reason_custom
ALTER TABLE "maintenance_task_vehicles" ADD COLUMN "reschedule_reason_id" UUID;
ALTER TABLE "maintenance_task_vehicles" ADD COLUMN "reschedule_reason_custom" TEXT;

-- Migrate existing data: move free-text reschedule_reason to reschedule_reason_custom
UPDATE "maintenance_task_vehicles"
SET "reschedule_reason_custom" = "reschedule_reason"
WHERE "reschedule_reason" IS NOT NULL;

-- Drop old column
ALTER TABLE "maintenance_task_vehicles" DROP COLUMN "reschedule_reason";

-- AddForeignKey
ALTER TABLE "maintenance_task_vehicles" ADD CONSTRAINT "maintenance_task_vehicles_reschedule_reason_id_fkey" FOREIGN KEY ("reschedule_reason_id") REFERENCES "reasons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
