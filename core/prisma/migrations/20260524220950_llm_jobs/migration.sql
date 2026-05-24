-- CreateEnum
CREATE TYPE "LlmJobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- DropIndex
DROP INDEX "ingredients_name_trgm_idx";

-- CreateTable
CREATE TABLE "llm_jobs" (
    "id" TEXT NOT NULL,
    "pg_boss_job_id" TEXT,
    "job_kind" TEXT NOT NULL,
    "user_id" TEXT,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "status" "LlmJobStatus" NOT NULL DEFAULT 'PENDING',
    "input" JSONB,
    "output" JSONB,
    "error" TEXT,
    "input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "cache_read_tokens" INTEGER,
    "cache_write_tokens" INTEGER,
    "cost_usd" DECIMAL(10,6),
    "duration_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "llm_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "llm_jobs_pg_boss_job_id_key" ON "llm_jobs"("pg_boss_job_id");

-- CreateIndex
CREATE INDEX "llm_jobs_job_kind_status_idx" ON "llm_jobs"("job_kind", "status");

-- CreateIndex
CREATE INDEX "llm_jobs_user_id_idx" ON "llm_jobs"("user_id");

-- CreateIndex
CREATE INDEX "llm_jobs_created_at_idx" ON "llm_jobs"("created_at" DESC);
