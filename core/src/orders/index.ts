// Barrel домена orders (scr-order-products): корзина → история заказов.
export { placeOrder, listOrders } from './service.js';
export type { PlaceOrderResult } from './service.js';
export { groupCartIntoOrders } from './group.js';
export type { CartItemForOrder, OrderDraft } from './types.js';
export { placeOrderRequestSchema } from './schemas.js';
export type { PlaceOrderRequest } from './schemas.js';
