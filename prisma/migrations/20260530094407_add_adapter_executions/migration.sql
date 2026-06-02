/*
  Warnings:

  - Made the column `license_risk_tier` on table `repositories` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "repositories" ADD COLUMN     "eslint_errors_count" INTEGER DEFAULT 0,
ADD COLUMN     "eslint_status" VARCHAR(50),
ALTER COLUMN "license_risk_tier" SET NOT NULL;

-- CreateTable
CREATE TABLE "adapter_executions" (
    "id" TEXT NOT NULL,
    "repository_id" INTEGER,
    "feature_id" INTEGER,
    "adapter_name" VARCHAR(100) NOT NULL,
    "file_path" VARCHAR(500),
    "input" JSONB NOT NULL,
    "output" JSONB,
    "status" VARCHAR(50) NOT NULL,
    "duration" INTEGER,
    "error_message" TEXT,
    "executed_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lint_errors" INTEGER DEFAULT 0,

    CONSTRAINT "adapter_executions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "adapter_executions_adapter_name_idx" ON "adapter_executions"("adapter_name");

-- CreateIndex
CREATE INDEX "adapter_executions_repository_id_idx" ON "adapter_executions"("repository_id");

-- CreateIndex
CREATE INDEX "adapter_executions_feature_id_idx" ON "adapter_executions"("feature_id");

-- CreateIndex
CREATE INDEX "adapter_executions_status_idx" ON "adapter_executions"("status");

-- AddForeignKey
ALTER TABLE "adapter_executions" ADD CONSTRAINT "adapter_executions_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adapter_executions" ADD CONSTRAINT "adapter_executions_feature_id_fkey" FOREIGN KEY ("feature_id") REFERENCES "features"("id") ON DELETE CASCADE ON UPDATE CASCADE;
