/**
 * Человекочитаемая сводка результата инструмента агента — дописывается к reply, чтобы
 * пользователь видел КОНКРЕТНЫЕ данные (числа), а не только вступление LLM («сейчас рассчитаю…»).
 *
 * Детерминированно и мгновенно (без второго LLM-вызова). Возвращает null, если сводку
 * по этому tool/результату не построить (тогда appendix не добавляется).
 */
const r0 = (v: unknown): number => Math.round(Number(v) || 0);

export function summarizeToolResult(tool: string, result: unknown): string | null {
  if (result == null || typeof result !== 'object') return null;
  const r = result as Record<string, unknown>;

  switch (tool) {
    case 'calc_norms':
      return `📊 Ваши нормы: ${r0(r['kcalPerDay'])} ккал/день · белок ${r0(r['proteinGPerDay'])} г · жиры ${r0(r['fatGPerDay'])} г · углеводы ${r0(r['carbsGPerDay'])} г (BMR ${r0(r['bmr'])}, TDEE ${r0(r['tdee'])}).`;

    case 'get_anthropometry': {
      if (r['heightCm'] == null && r['weightKg'] == null) return 'Антропометрия не заполнена — добавьте её в разделе «Здоровье».';
      const sex = r['sex'] === 'MALE' ? 'муж' : r['sex'] === 'FEMALE' ? 'жен' : '—';
      const bf = r['bodyFatPercent'] != null ? `, жир ${r0(r['bodyFatPercent'])}%` : '';
      const goal = r['goal'] ? `, цель ${String(r['goal'])}` : '';
      // Активность: предпочтительно гранулярно (шаги/силовые/кардио), иначе грубый activityLevel.
      const act: string[] = [];
      if (r['stepsPerDay'] != null) act.push(`${r0(r['stepsPerDay'])} шаг/день`);
      if (r['strengthMinutesPerWeek'] != null) act.push(`силовые ${r0(r['strengthMinutesPerWeek'])} мин/нед`);
      if (r['cardioMinutesPerWeek'] != null) act.push(`кардио ${r0(r['cardioMinutesPerWeek'])} мин/нед`);
      if (act.length === 0 && r['activityLevel']) act.push(`активность ${String(r['activityLevel'])}`);
      const actStr = act.length > 0 ? `, ${act.join(', ')}` : '';
      return `🧍 Параметры: ${sex}, ${r0(r['ageYears'])} лет, рост ${r0(r['heightCm'])} см, вес ${r0(r['weightKg'])} кг${bf}${actStr}${goal}.`;
    }

    case 'get_stock': {
      const lines = Array.isArray(r['lines']) ? (r['lines'] as Array<Record<string, unknown>>) : [];
      if (lines.length === 0) return '📦 Остатков пока нет.';
      const deficits = lines.filter((l) => Number(l['projectedG']) < 0).length;
      const base = `📦 Остатки: ${lines.length} позиц.`;
      return deficits > 0 ? `${base} ⚠ дефицит по ${deficits}.` : `${base} Дефицитов нет.`;
    }

    case 'get_week_plan': {
      if (!r['weekIso'] && !r['days']) return '🗓 План на эту неделю не найден — сгенерируйте его на странице «План».';
      const days = Array.isArray(r['days']) ? (r['days'] as Array<Record<string, unknown>>) : [];
      const meals = days.reduce((n, d) => n + (Array.isArray(d['meals']) ? (d['meals'] as unknown[]).length : 0), 0);
      return `🗓 План ${String(r['weekIso'] ?? '')}: ${days.length} дн., ${meals} приёмов.`;
    }

    case 'correct_plan': {
      const days = Array.isArray(r['days']) ? (r['days'] as unknown[]).length : null;
      return days != null ? `📈 Сверка факт vs план: ${days} дн.` : null;
    }

    case 'write_diary': {
      const name = r['mealName'] ?? r['customName'] ?? 'приём';
      return `✍ Записано в дневник: ${String(name)}${r['kcal'] != null ? `, ${r0(r['kcal'])} ккал` : ''}.`;
    }

    default:
      return null;
  }
}
