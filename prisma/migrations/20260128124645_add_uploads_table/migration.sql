-- AlterEnum
ALTER TYPE "AuditEntityType" ADD VALUE 'upload';

-- CreateTable
CREATE TABLE "uploads" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "object_key" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "file_size" BIGINT NOT NULL,
    "uploaded_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimed_at" TIMESTAMP(3),

    CONSTRAINT "uploads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "uploads_tenant_id_claimed_at_created_at_idx" ON "uploads"("tenant_id", "claimed_at", "created_at");

-- CreateIndex
CREATE INDEX "uploads_tenant_id_file_url_idx" ON "uploads"("tenant_id", "file_url");
