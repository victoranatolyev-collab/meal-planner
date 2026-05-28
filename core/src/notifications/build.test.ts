import { describe, it, expect } from 'vitest';
import { buildReminderTasks } from './build.js';
import type { ScheduleInput } from './types.js';

function sched(over: Partial<ScheduleInput> = {}): ScheduleInput {
  return {
    id: 's1',
    triggerType: 'MEAL_RELATIVE',
    schedule: 'meal:lunch+30m',
    reminderList: 'Daily',
    template: 'Iron-окно: без кофе',
    isActive: true,
    ...over,
  };
}

describe('buildReminderTasks', () => {
  it('исключает неактивные расписания', () => {
    const tasks = buildReminderTasks([sched({ isActive: false })], '2026-05-29');
    expect(tasks).toEqual([]);
  });

  it('детерминированный uid = scheduleId:date (дедуп)', () => {
    const a = buildReminderTasks([sched({ id: 'abc' })], '2026-05-29');
    const b = buildReminderTasks([sched({ id: 'abc' })], '2026-05-29');
    expect(a[0]?.uid).toBe('abc:2026-05-29');
    expect(a).toEqual(b); // повторный билд → идентичные задачи
  });

  it('title = template, list = reminderList', () => {
    const [t] = buildReminderTasks([sched({ template: 'Пора обедать', reminderList: 'Meals' })], '2026-05-29');
    expect(t?.title).toBe('Пора обедать');
    expect(t?.list).toBe('Meals');
  });

  it('TIME "HH:MM" → dueAt = дата+время', () => {
    const [t] = buildReminderTasks([sched({ triggerType: 'TIME', schedule: '08:30' })], '2026-05-29');
    expect(t?.dueAt).toBe('2026-05-29T08:30:00');
  });

  it('MEAL_RELATIVE → dueAt null', () => {
    const [t] = buildReminderTasks([sched({ triggerType: 'MEAL_RELATIVE' })], '2026-05-29');
    expect(t?.dueAt).toBeNull();
  });
});
