-- Гранулярные входы активности для scr-calc-norms (модель doctorushakov):
-- силовые и кардио минуты в неделю (шаги уже есть в steps_per_day).
ALTER TABLE "anthropometry" ADD COLUMN "strength_minutes_per_week" INTEGER;
ALTER TABLE "anthropometry" ADD COLUMN "cardio_minutes_per_week" INTEGER;
