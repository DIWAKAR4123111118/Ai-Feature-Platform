-- CreateTable
CREATE TABLE "Feature" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Feature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureRepo" (
    "id" TEXT NOT NULL,
    "featureId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "repo" TEXT NOT NULL,
    "repoUrl" TEXT NOT NULL,
    "stars" INTEGER,
    "licenseSpdx" TEXT,
    "lastCommitAt" TIMESTAMP(3),
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "healthScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureRepo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureVersion" (
    "id" TEXT NOT NULL,
    "featureId" TEXT NOT NULL,
    "versionLabel" TEXT NOT NULL,
    "sourceCommit" TEXT NOT NULL,
    "adapterVersion" TEXT NOT NULL,
    "approvalStatus" TEXT NOT NULL DEFAULT 'pending',
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeatureVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scan" (
    "id" TEXT NOT NULL,
    "featureRepoId" TEXT NOT NULL,
    "scanType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "toolVersion" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "summary" JSONB NOT NULL DEFAULT '{}',
    "rawArtifactPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Scan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScanFinding" (
    "id" TEXT NOT NULL,
    "scanId" TEXT NOT NULL,
    "severity" TEXT,
    "title" TEXT NOT NULL,
    "packageName" TEXT,
    "affectedVersion" TEXT,
    "fixedVersion" TEXT,
    "advisoryUrl" TEXT,
    "location" JSONB,
    "findingHash" TEXT NOT NULL,

    CONSTRAINT "ScanFinding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Feature_name_key" ON "Feature"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Feature_slug_key" ON "Feature"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureRepo_provider_owner_repo_key" ON "FeatureRepo"("provider", "owner", "repo");

-- CreateIndex
CREATE UNIQUE INDEX "ScanFinding_scanId_findingHash_key" ON "ScanFinding"("scanId", "findingHash");

-- AddForeignKey
ALTER TABLE "FeatureRepo" ADD CONSTRAINT "FeatureRepo_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "Feature"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatureVersion" ADD CONSTRAINT "FeatureVersion_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "Feature"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scan" ADD CONSTRAINT "Scan_featureRepoId_fkey" FOREIGN KEY ("featureRepoId") REFERENCES "FeatureRepo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScanFinding" ADD CONSTRAINT "ScanFinding_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "Scan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
