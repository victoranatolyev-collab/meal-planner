import { apiGet, apiPost } from './client';

export interface OrderItemDto {
  id: string;
  qtyG: number;
  priceRub: string | null;
  ingredient: { name: string; source: string } | null;
}

export interface OrderDto {
  id: string;
  shop: string;
  status: string;
  totalRub: string | null;
  orderedAt: string;
  items: OrderItemDto[];
}

export const fetchOrders = (userId: string) =>
  apiGet<{ items: OrderDto[]; total: number }>(`/orders?userId=${encodeURIComponent(userId)}`);

/** Оформить заказ из активной корзины (группируется по магазинам). */
export const placeOrder = (userId: string) =>
  apiPost<{ orders: unknown[] }>('/orders', { userId });
