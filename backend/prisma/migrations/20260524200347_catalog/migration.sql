-- CreateEnum
CREATE TYPE "IngredientSource" AS ENUM ('FIVEKA', 'TSEH', 'LL', 'VV', 'CUSTOM');

-- CreateTable
CREATE TABLE "source_5ka" (
    "id" TEXT NOT NULL,
    "parsed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "raw" JSONB NOT NULL,
    "summary" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "source_5ka_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_tseh" (
    "id" TEXT NOT NULL,
    "parsed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "raw" JSONB NOT NULL,
    "summary" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "source_tseh_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_ll" (
    "id" TEXT NOT NULL,
    "parsed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "raw" JSONB NOT NULL,
    "summary" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "source_ll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_vv" (
    "id" TEXT NOT NULL,
    "parsed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "raw" JSONB NOT NULL,
    "summary" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "source_vv_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingredients" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "source" "IngredientSource" NOT NULL,
    "external_code" TEXT,
    "kcal_100g" DECIMAL(8,2),
    "protein_100g" DECIMAL(6,2),
    "fat_100g" DECIMAL(6,2),
    "carbs_100g" DECIMAL(6,2),
    "price_per_100g" DECIMAL(10,2),
    "weight_g" INTEGER,
    "pack_size" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'g',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "source_5ka_parsed_at_idx" ON "source_5ka"("parsed_at" DESC);

-- CreateIndex
CREATE INDEX "source_tseh_parsed_at_idx" ON "source_tseh"("parsed_at" DESC);

-- CreateIndex
CREATE INDEX "source_ll_parsed_at_idx" ON "source_ll"("parsed_at" DESC);

-- CreateIndex
CREATE INDEX "source_vv_parsed_at_idx" ON "source_vv"("parsed_at" DESC);

-- CreateIndex
CREATE INDEX "ingredients_source_idx" ON "ingredients"("source");

-- CreateIndex
CREATE INDEX "ingredients_name_idx" ON "ingredients"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ingredients_name_source_pack_size_key" ON "ingredients"("name", "source", "pack_size");
