-- CreateEnum
CREATE TYPE "TagCategory" AS ENUM ('NUTRIENT', 'ALLERGEN', 'CATEGORY', 'BEHAVIOR', 'MEAL_TAG', 'OTHER');

-- CreateEnum
CREATE TYPE "RuleKind" AS ENUM ('BAN_TAG', 'BAN_TAG_IN_MEAL', 'REQUIRE_TAG_IN_MEAL', 'MIN_PER_WEEK', 'MAX_PER_WEEK');

-- CreateEnum
CREATE TYPE "RecipeSource" AS ENUM ('LLM', 'MANUAL', 'IMPORTED');

-- AlterTable
ALTER TABLE "ingredients" ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "tag_dictionary" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "TagCategory" NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tag_dictionary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nutrition_targets" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "kcal_per_day" DECIMAL(7,2) NOT NULL,
    "protein_g_per_day" DECIMAL(6,2) NOT NULL,
    "fat_g_per_day" DECIMAL(6,2) NOT NULL,
    "carbs_g_per_day" DECIMAL(6,2) NOT NULL,
    "protein_g_per_kg_min" DECIMAL(4,2),
    "budget_target_rub_per_week" DECIMAL(8,2),
    "budget_soft_cap_rub_per_week" DECIMAL(8,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nutrition_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tag_rules" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "rule_kind" "RuleKind" NOT NULL,
    "tag_name" TEXT NOT NULL,
    "meal_tag" TEXT,
    "quantity" INTEGER,
    "exception_tag" TEXT,
    "reason" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tag_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "instructions" TEXT NOT NULL DEFAULT '',
    "is_relevant" BOOLEAN NOT NULL DEFAULT false,
    "is_normalized" BOOLEAN NOT NULL DEFAULT false,
    "is_approved" BOOLEAN NOT NULL DEFAULT false,
    "rejection_reasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "total_kcal" DECIMAL(8,2),
    "total_protein_g" DECIMAL(7,2),
    "total_fat_g" DECIMAL(7,2),
    "total_carbs_g" DECIMAL(7,2),
    "source" "RecipeSource" NOT NULL DEFAULT 'MANUAL',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_ingredients" (
    "recipe_id" TEXT NOT NULL,
    "ingredient_id" TEXT NOT NULL,
    "qty_g" INTEGER NOT NULL,
    "fresh_addon" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,

    CONSTRAINT "recipe_ingredients_pkey" PRIMARY KEY ("recipe_id","ingredient_id")
);

-- CreateTable
CREATE TABLE "recipe_tags" (
    "recipe_id" TEXT NOT NULL,
    "tag_name" TEXT NOT NULL,

    CONSTRAINT "recipe_tags_pkey" PRIMARY KEY ("recipe_id","tag_name")
);

-- CreateIndex
CREATE UNIQUE INDEX "tag_dictionary_name_key" ON "tag_dictionary"("name");

-- CreateIndex
CREATE INDEX "tag_dictionary_category_idx" ON "tag_dictionary"("category");

-- CreateIndex
CREATE UNIQUE INDEX "nutrition_targets_user_id_key" ON "nutrition_targets"("user_id");

-- CreateIndex
CREATE INDEX "tag_rules_user_id_is_active_idx" ON "tag_rules"("user_id", "is_active");

-- CreateIndex
CREATE INDEX "tag_rules_tag_name_idx" ON "tag_rules"("tag_name");

-- CreateIndex
CREATE INDEX "recipes_user_id_idx" ON "recipes"("user_id");

-- CreateIndex
CREATE INDEX "recipes_user_id_is_approved_idx" ON "recipes"("user_id", "is_approved");

-- CreateIndex
CREATE INDEX "recipe_tags_tag_name_idx" ON "recipe_tags"("tag_name");

-- AddForeignKey
ALTER TABLE "nutrition_targets" ADD CONSTRAINT "nutrition_targets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tag_rules" ADD CONSTRAINT "tag_rules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_tags" ADD CONSTRAINT "recipe_tags_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Manual GIN index on ingredients.tags (Prisma не поддерживает inline GIN для text[]).
-- Используется для быстрых выборок типа `WHERE 'lactose' = ANY(tags)`.
CREATE INDEX "ingredients_tags_gin" ON "ingredients" USING GIN("tags");
