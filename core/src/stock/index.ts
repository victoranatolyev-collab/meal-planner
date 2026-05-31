// Barrel домена stock (scr-calc-stock): проекция остатков.
export { calcStock } from './service.js';
export type { CalcStockResult } from './service.js';
export { projectStock } from './project.js';
export type { StockProjectionLine } from './types.js';
export {
  listStockBaseline,
  upsertStockItem,
  deleteStockItem,
  stockItemUpsertSchema,
  stockItemDeleteSchema,
} from './baseline-service.js';
export type { StockItemUpsert } from './baseline-service.js';
