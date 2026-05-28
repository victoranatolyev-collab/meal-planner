-- CreateEnum
CREATE TYPE "NotificationTrigger" AS ENUM ('TIME', 'EVENT', 'MEAL_RELATIVE');

-- CreateTable
CREATE TABLE "notification_schedules" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "trigger_type" "NotificationTrigger" NOT NULL,
    "schedule" TEXT NOT NULL,
    "reminder_list" TEXT NOT NULL DEFAULT 'Daily',
    "template" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notification_schedules_user_id_is_active_idx" ON "notification_schedules"("user_id", "is_active");

-- AddForeignKey
ALTER TABLE "notification_schedules" ADD CONSTRAINT "notification_schedules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
