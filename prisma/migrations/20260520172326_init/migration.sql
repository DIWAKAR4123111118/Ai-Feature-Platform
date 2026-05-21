-- CreateTable
CREATE TABLE "features" (
    "id" SERIAL NOT NULL,
    "repo_id" INTEGER,
    "name" VARCHAR(255) NOT NULL,
    "version" VARCHAR(50),
    "description" TEXT,
    "status" VARCHAR(50) DEFAULT 'discovered',
    "approved" BOOLEAN DEFAULT false,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "features_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repositories" (
    "id" SERIAL NOT NULL,
    "github_url" VARCHAR(500) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "stars" INTEGER DEFAULT 0,
    "language" VARCHAR(100),
    "license_spdx" VARCHAR(100),
    "license_text" TEXT,
    "license_risk_tier" VARCHAR(50) DEFAULT 'unknown',
    "license_accepted" BOOLEAN DEFAULT false,
    "license_accepted_by" VARCHAR(255),
    "license_accepted_at" TIMESTAMP(6),
    "security_score" INTEGER,
    "quality_score" INTEGER,
    "status" VARCHAR(50) DEFAULT 'pending',
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "repositories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_scans" (
    "id" SERIAL NOT NULL,
    "repo_id" INTEGER,
    "scan_type" VARCHAR(100) NOT NULL,
    "result" JSONB,
    "vulnerabilities_count" INTEGER DEFAULT 0,
    "passed" BOOLEAN DEFAULT false,
    "scanned_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_scans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "github_username" VARCHAR(255),
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_features_approved" ON "features"("approved");

-- CreateIndex
CREATE UNIQUE INDEX "repositories_github_url_key" ON "repositories"("github_url");

-- CreateIndex
CREATE INDEX "idx_repos_status" ON "repositories"("status");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "idx_users_email" ON "users"("email");

-- AddForeignKey
ALTER TABLE "features" ADD CONSTRAINT "features_repo_id_fkey" FOREIGN KEY ("repo_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "security_scans" ADD CONSTRAINT "security_scans_repo_id_fkey" FOREIGN KEY ("repo_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
