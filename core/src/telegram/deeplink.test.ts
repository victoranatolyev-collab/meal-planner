import { describe, it, expect } from 'vitest';
import { buildStartDeepLink } from './service.js';

describe('buildStartDeepLink', () => {
  it('собирает t.me deep-link с токеном в start-параметре', () => {
    expect(buildStartDeepLink('meal_bot', 'abc-123')).toBe('https://t.me/meal_bot?start=abc-123');
  });
});
