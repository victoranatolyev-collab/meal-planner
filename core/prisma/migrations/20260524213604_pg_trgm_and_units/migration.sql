-- DropIndex
DROP INDEX "ingredients_tags_gin";

-- AlterTable
ALTER TABLE "recipes" ADD COLUMN     "raw_ingredients" JSONB;

-- CreateTable
CREATE TABLE "unit_conversions" (
    "id" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "grams_per_unit" DECIMAL(10,4) NOT NULL,
    "ingredient_tag" TEXT,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "unit_conversions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "unit_conversions_unit_key" ON "unit_conversions"("unit");

-- pg_trgm extension для fuzzy-matching ингредиентов (см. ARCHITECTURE.md scr-normalize-recipe).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN trigram-индекс на ingredients.name — для быстрого similarity-поиска.
CREATE INDEX "ingredients_name_trgm_idx" ON "ingredients" USING GIN(name gin_trgm_ops);

-- Seed unit_conversions: универсальные дефолты (is_system=true).
INSERT INTO "unit_conversions" (id, unit, grams_per_unit, ingredient_tag, description, is_system, created_at, updated_at) VALUES
  (gen_random_uuid()::text, 'г',               1,    NULL, 'грамм (basis)',                    true, NOW(), NOW()),
  (gen_random_uuid()::text, 'g',               1,    NULL, 'gram (basis)',                     true, NOW(), NOW()),
  (gen_random_uuid()::text, 'грамм',           1,    NULL, 'грамм (full word)',                true, NOW(), NOW()),
  (gen_random_uuid()::text, 'кг',              1000, NULL, 'килограмм',                        true, NOW(), NOW()),
  (gen_random_uuid()::text, 'kg',              1000, NULL, 'kilogram',                         true, NOW(), NOW()),
  (gen_random_uuid()::text, 'мл',              1,    NULL, 'миллилитр (≈1g для жидких)',       true, NOW(), NOW()),
  (gen_random_uuid()::text, 'ml',              1,    NULL, 'milliliter (≈1g for liquids)',     true, NOW(), NOW()),
  (gen_random_uuid()::text, 'л',               1000, NULL, 'литр',                             true, NOW(), NOW()),
  (gen_random_uuid()::text, 'l',               1000, NULL, 'liter',                            true, NOW(), NOW()),
  (gen_random_uuid()::text, 'столовая ложка',  15,   NULL, 'столовая ложка (~15г)',            true, NOW(), NOW()),
  (gen_random_uuid()::text, 'ст. ложка',       15,   NULL, 'ст. ложка',                        true, NOW(), NOW()),
  (gen_random_uuid()::text, 'tbsp',            15,   NULL, 'tablespoon',                       true, NOW(), NOW()),
  (gen_random_uuid()::text, 'чайная ложка',    5,    NULL, 'чайная ложка (~5г)',               true, NOW(), NOW()),
  (gen_random_uuid()::text, 'ч. ложка',        5,    NULL, 'ч. ложка',                         true, NOW(), NOW()),
  (gen_random_uuid()::text, 'tsp',             5,    NULL, 'teaspoon',                         true, NOW(), NOW()),
  (gen_random_uuid()::text, 'шт',              50,   'egg', 'штука (default для тэга egg ~50г)', true, NOW(), NOW());
