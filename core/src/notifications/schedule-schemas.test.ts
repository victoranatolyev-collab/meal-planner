import { describe, it, expect } from 'vitest';
import { scheduleCreateSchema, scheduleUpdateSchema } from './schedule-schemas.js';

const UID = '11111111-1111-1111-1111-111111111111';

describe('scheduleCreateSchema', () => {
  it('валидный + defaults (reminderList Daily, isActive true)', () => {
    const p = scheduleCreateSchema.parse({
      userId: UID,
      triggerType: 'TIME',
      schedule: '08:30',
      template: 'Завтрак',
    });
    expect(p.reminderList).toBe('Daily');
    expect(p.isActive).toBe(true);
  });

  it('отвергает неизвестный triggerType', () => {
    expect(
      scheduleCreateSchema.safeParse({ userId: UID, triggerType: 'NOPE', schedule: 'x', template: 't' })
        .success,
    ).toBe(false);
  });

  it('требует template', () => {
    expect(
      scheduleCreateSchema.safeParse({ userId: UID, triggerType: 'TIME', schedule: '08:30' }).success,
    ).toBe(false);
  });
});

describe('scheduleUpdateSchema', () => {
  it('частичный patch', () => {
    expect(scheduleUpdateSchema.safeParse({ isActive: false }).success).toBe(true);
  });
  it('пустой patch → fail', () => {
    expect(scheduleUpdateSchema.safeParse({}).success).toBe(false);
  });
});
