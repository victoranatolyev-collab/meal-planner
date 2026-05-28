-- CreateEnum
CREATE TYPE "Sex" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "ActivityLevel" AS ENUM ('SEDENTARY', 'LIGHT', 'MODERATE', 'ACTIVE', 'VERY_ACTIVE');

-- CreateEnum
CREATE TYPE "Goal" AS ENUM ('CUT', 'MAINTAIN', 'GAIN');

-- CreateTable
CREATE TABLE "anthropometry" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "measured_at" TIMESTAMP(3) NOT NULL,
    "sex" "Sex" NOT NULL,
    "age_years" INTEGER NOT NULL,
    "height_cm" DECIMAL(5,1) NOT NULL,
    "weight_kg" DECIMAL(5,1) NOT NULL,
    "body_fat_percent" DECIMAL(4,1),
    "lean_mass_kg" DECIMAL(5,1),
    "bmi" DECIMAL(4,1),
    "ffmi" DECIMAL(4,1),
    "waist_cm" DECIMAL(5,1),
    "activity_level" "ActivityLevel",
    "steps_per_day" INTEGER,
    "goal" "Goal",
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "anthropometry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_tests" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "measured_at" TIMESTAMP(3) NOT NULL,
    "analyte" TEXT NOT NULL,
    "value" DECIMAL(12,4) NOT NULL,
    "unit" TEXT NOT NULL,
    "reference_low" DECIMAL(12,4),
    "reference_high" DECIMAL(12,4),
    "status" TEXT,
    "is_flagged" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lab_tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "performed_at" TIMESTAMP(3) NOT NULL,
    "kind" TEXT NOT NULL,
    "duration_min" INTEGER NOT NULL,
    "intensity" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mood_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "logged_at" TIMESTAMP(3) NOT NULL,
    "mood" INTEGER,
    "energy" INTEGER,
    "sleep_hours" DECIMAL(3,1),
    "symptoms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mood_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "anthropometry_user_id_measured_at_idx" ON "anthropometry"("user_id", "measured_at" DESC);

-- CreateIndex
CREATE INDEX "lab_tests_user_id_analyte_measured_at_idx" ON "lab_tests"("user_id", "analyte", "measured_at" DESC);

-- CreateIndex
CREATE INDEX "training_logs_user_id_performed_at_idx" ON "training_logs"("user_id", "performed_at" DESC);

-- CreateIndex
CREATE INDEX "mood_logs_user_id_logged_at_idx" ON "mood_logs"("user_id", "logged_at" DESC);

-- AddForeignKey
ALTER TABLE "anthropometry" ADD CONSTRAINT "anthropometry_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_tests" ADD CONSTRAINT "lab_tests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_logs" ADD CONSTRAINT "training_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mood_logs" ADD CONSTRAINT "mood_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
