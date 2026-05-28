-- CreateTable
CREATE TABLE "food_diary" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "eaten_at" TIMESTAMP(3) NOT NULL,
    "recipe_id" TEXT,
    "custom_name" TEXT,
    "portion_factor" DECIMAL(4,2) NOT NULL DEFAULT 1.0,
    "kcal" DECIMAL(8,2),
    "protein_g" DECIMAL(7,2),
    "fat_g" DECIMAL(7,2),
    "carbs_g" DECIMAL(7,2),
    "meal_name" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "food_diary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "food_diary_user_id_eaten_at_idx" ON "food_diary"("user_id", "eaten_at" DESC);

-- AddForeignKey
ALTER TABLE "food_diary" ADD CONSTRAINT "food_diary_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food_diary" ADD CONSTRAINT "food_diary_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
