-- CreateEnum
CREATE TYPE "WeekPlanStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateTable
CREATE TABLE "week_plans" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "week_iso" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "status" "WeekPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "kcal_target" DECIMAL(7,2) NOT NULL,
    "protein_g_target" DECIMAL(6,2) NOT NULL,
    "fat_g_target" DECIMAL(6,2) NOT NULL,
    "carbs_g_target" DECIMAL(6,2) NOT NULL,
    "budget_target_rub" DECIMAL(8,2),
    "budget_soft_cap_rub" DECIMAL(8,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "week_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_days" (
    "id" TEXT NOT NULL,
    "week_plan_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "day_type" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_meals" (
    "id" TEXT NOT NULL,
    "plan_day_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "time" TEXT,
    "sort_order" INTEGER NOT NULL,
    "meal_tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_meals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_meal_items" (
    "id" TEXT NOT NULL,
    "plan_meal_id" TEXT NOT NULL,
    "recipe_id" TEXT NOT NULL,
    "portion_factor" DECIMAL(4,2) NOT NULL DEFAULT 1.0,
    "from_stock" BOOLEAN NOT NULL DEFAULT false,
    "tail" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_meal_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "week_plans_user_id_status_idx" ON "week_plans"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "week_plans_user_id_week_iso_key" ON "week_plans"("user_id", "week_iso");

-- CreateIndex
CREATE INDEX "plan_days_week_plan_id_idx" ON "plan_days"("week_plan_id");

-- CreateIndex
CREATE UNIQUE INDEX "plan_days_week_plan_id_date_key" ON "plan_days"("week_plan_id", "date");

-- CreateIndex
CREATE INDEX "plan_meals_plan_day_id_idx" ON "plan_meals"("plan_day_id");

-- CreateIndex
CREATE INDEX "plan_meal_items_plan_meal_id_idx" ON "plan_meal_items"("plan_meal_id");

-- CreateIndex
CREATE INDEX "plan_meal_items_recipe_id_idx" ON "plan_meal_items"("recipe_id");

-- AddForeignKey
ALTER TABLE "week_plans" ADD CONSTRAINT "week_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_days" ADD CONSTRAINT "plan_days_week_plan_id_fkey" FOREIGN KEY ("week_plan_id") REFERENCES "week_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_meals" ADD CONSTRAINT "plan_meals_plan_day_id_fkey" FOREIGN KEY ("plan_day_id") REFERENCES "plan_days"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_meal_items" ADD CONSTRAINT "plan_meal_items_plan_meal_id_fkey" FOREIGN KEY ("plan_meal_id") REFERENCES "plan_meals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_meal_items" ADD CONSTRAINT "plan_meal_items_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
