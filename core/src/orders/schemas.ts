import { z } from 'zod';

/** Запрос на отправку заказа (scr-order-products): ACTIVE Cart пользователя → order_history. */
export const placeOrderRequestSchema = z.object({
  userId: z.string().uuid(),
});
export type PlaceOrderRequest = z.infer<typeof placeOrderRequestSchema>;
