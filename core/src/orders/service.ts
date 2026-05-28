import pino from 'pino';
import { prisma } from '../db.js';
import { groupCartIntoOrders } from './group.js';

const logger = pino({ name: 'orders:place' });

export interface PlaceOrderResult {
  orders: Array<{ orderId: string; shop: string; items: number; totalRub: number }>;
}

/**
 * scr-order-products (DB-wrapper): ACTIVE Cart пользователя → order_history.
 * Группирует позиции по магазину → Order на магазин (status PLACED) + OrderItem с ценами.
 * Корзина → ORDERED. Транзакция. Реальный API магазина — backlog (сейчас только запись в БД).
 */
export async function placeOrder(userId: string): Promise<PlaceOrderResult> {
  const cart = await prisma.cart.findFirst({
    where: { userId, status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' },
    include: { items: { include: { ingredient: { select: { pricePer100g: true } } } } },
  });
  if (!cart) throw new Error(`Нет активной корзины для ${userId}`);
  if (cart.items.length === 0) throw new Error('Корзина пуста — нечего заказывать');

  const drafts = groupCartIntoOrders(
    cart.items.map((i) => ({
      ingredientId: i.ingredientId,
      qtyG: i.qtyG,
      shop: i.shop,
      pricePer100g: i.ingredient.pricePer100g !== null ? Number(i.ingredient.pricePer100g) : null,
    })),
  );

  const orders = await prisma.$transaction(async (tx) => {
    const created: PlaceOrderResult['orders'] = [];
    for (const d of drafts) {
      const order = await tx.order.create({
        data: {
          userId,
          shop: d.shop,
          status: 'PLACED',
          totalRub: d.totalRub,
          items: {
            create: d.items.map((it) => ({
              ingredientId: it.ingredientId,
              qtyG: it.qtyG,
              priceRub: it.priceRub,
            })),
          },
        },
      });
      created.push({ orderId: order.id, shop: d.shop, items: d.items.length, totalRub: d.totalRub });
    }
    await tx.cart.update({ where: { id: cart.id }, data: { status: 'ORDERED' } });
    return created;
  });

  logger.info({ userId, cartId: cart.id, orders: orders.length }, 'order placed');
  return { orders };
}

/** История заказов пользователя (+ позиции и инфо ингредиента). */
export async function listOrders(userId: string) {
  return prisma.order.findMany({
    where: { userId },
    orderBy: { orderedAt: 'desc' },
    include: { items: { include: { ingredient: { select: { name: true, source: true } } } } },
  });
}
