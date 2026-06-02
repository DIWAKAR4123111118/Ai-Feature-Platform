-- CreateTable
CREATE TABLE "feature_repositories" (
    "id" SERIAL NOT NULL,
    "feature_id" INTEGER NOT NULL,
    "repository_id" INTEGER NOT NULL,
    "licenseRiskTier" VARCHAR(50) NOT NULL DEFAULT 'unknown',
    "licenseAccepted" BOOLEAN NOT NULL DEFAULT false,
    "licenseAcceptedBy" VARCHAR(255),
    "licenseAcceptedAt" TIMESTAMP(6),
    "licenseText" TEXT,

    CONSTRAINT "feature_repositories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "feature_repositories_feature_id_idx" ON "feature_repositories"("feature_id");

-- CreateIndex
CREATE INDEX "feature_repositories_repository_id_idx" ON "feature_repositories"("repository_id");

-- CreateIndex
CREATE UNIQUE INDEX "feature_repositories_feature_id_repository_id_key" ON "feature_repositories"("feature_id", "repository_id");

-- AddForeignKey
ALTER TABLE "feature_repositories" ADD CONSTRAINT "feature_repositories_feature_id_fkey" FOREIGN KEY ("feature_id") REFERENCES "features"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feature_repositories" ADD CONSTRAINT "feature_repositories_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
