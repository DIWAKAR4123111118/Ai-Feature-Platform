-- CreateTable
CREATE TABLE "project_api_keys" (
    "id" SERIAL NOT NULL,
    "project_id" INTEGER NOT NULL,
    "key" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "project_api_keys_key_key" ON "project_api_keys"("key");

-- CreateIndex
CREATE INDEX "project_api_keys_project_id_idx" ON "project_api_keys"("project_id");

-- AddForeignKey
ALTER TABLE "project_api_keys" ADD CONSTRAINT "project_api_keys_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
