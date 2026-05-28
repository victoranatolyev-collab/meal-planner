import { describe, it, expect } from 'vitest';
import { AGENT_TOOLS, toolList } from './tools.js';

describe('AGENT_TOOLS registry', () => {
  it('содержит ожидаемый набор scr-* инструментов', () => {
    expect(Object.keys(AGENT_TOOLS).sort()).toEqual(
      ['calc_norms', 'correct_plan', 'get_stock', 'get_week_plan', 'write_diary'].sort(),
    );
  });

  it('каждый tool: name совпадает с ключом, есть description и execute', () => {
    for (const [key, tool] of Object.entries(AGENT_TOOLS)) {
      expect(tool.name).toBe(key);
      expect(tool.description.length).toBeGreaterThan(0);
      expect(typeof tool.execute).toBe('function');
    }
  });
});

describe('toolList', () => {
  it('возвращает {name, description} для llm-service (без execute)', () => {
    const list = toolList();
    expect(list).toHaveLength(Object.keys(AGENT_TOOLS).length);
    for (const t of list) {
      expect(Object.keys(t).sort()).toEqual(['description', 'name']);
    }
  });
});
