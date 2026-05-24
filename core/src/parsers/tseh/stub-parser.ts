import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { TsehParser } from './parser.js';
import type { TsehParseResult } from './types.js';

/**
 * Stub-парсер: читает фикстуру вместо реального источника.
 * Полезен для:
 *  - dev/демо до того, как реальный API готов
 *  - юнит/интеграционных тестов (детерминированный input)
 *  - smoke-проверки идемпотентности импортера
 */
export class StubTsehParser implements TsehParser {
  constructor(
    private fixturePath?: string,
  ) {}

  async parse(): Promise<TsehParseResult> {
    const path =
      this.fixturePath ??
      join(dirname(fileURLToPath(import.meta.url)), '__fixtures__', 'sample.json');
    const raw = await readFile(path, 'utf-8');
    return JSON.parse(raw) as TsehParseResult;
  }
}
