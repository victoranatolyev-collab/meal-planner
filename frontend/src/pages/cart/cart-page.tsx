import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '@/lib/use-current-user';
import { Input } from '@/components/base/input/input';
import { Button } from '@/components/base/buttons/button';
import { assembleCart, fetchCart, type CartItemDto } from '@/api/cart';
import { fetchOrders, placeOrder, type OrderDto } from '@/api/orders';

// Страница /cart — собрать корзину из плана (scr-assemble-cart) → оформить заказ (scr-order-products).

const SHOP_LABEL: Record<string, string> = {
  FIVEKA: 'Пятёрочка',
  TSEH: 'Цех',
  LL: 'ЛавкаЛавка',
  VV: 'ВкусВилл',
  CUSTOM: 'Другое',
};

const lineCost = (i: CartItemDto): number =>
  i.ingredient?.pricePer100g ? (Number(i.ingredient.pricePer100g) * i.qtyG) / 100 : 0;

export default function CartPage() {
  const { userId, hasUser, isLoading } = useCurrentUser();
  const qc = useQueryClient();
  const [week, setWeek] = useState('2026-W22');

  const cartQuery = useQuery({
    queryKey: ['cart', userId],
    queryFn: () => fetchCart(userId as string),
    enabled: Boolean(userId),
  });
  const ordersQuery = useQuery({
    queryKey: ['orders', userId],
    queryFn: () => fetchOrders(userId as string),
    enabled: Boolean(userId),
  });

  const assembleMut = useMutation({
    mutationFn: () => assembleCart(userId as string, week.trim()),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['cart', userId] }),
  });
  const orderMut = useMutation({
    mutationFn: () => placeOrder(userId as string),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['cart', userId] });
      void qc.invalidateQueries({ queryKey: ['orders', userId] });
    },
  });

  const items = cartQuery.data?.items ?? [];
  const shops = [...new Set(items.map((i) => i.shop))];
  const total = items.reduce((a, i) => a + lineCost(i), 0);
  const orders: OrderDto[] = ordersQuery.data?.items ?? [];

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-display-xs font-semibold text-primary">Корзина и заказы</h1>
        <p className="text-sm text-tertiary">
          Собери корзину из плана недели, проверь по магазинам и оформи заказ.
        </p>
      </header>

      {isLoading && <p className="text-sm text-tertiary">Загрузка…</p>}
      {!isLoading && !hasUser && <p className="text-sm text-tertiary">Нет пользователя в БД.</p>}

      {hasUser && (
        <>
          <section className="flex items-end gap-3 rounded-xl border border-secondary bg-primary p-6">
            <div className="w-40">
              <Input label="Неделя (ISO)" value={week} onChange={setWeek} placeholder="2026-W22" />
            </div>
            <Button
              color="secondary"
              size="md"
              isLoading={assembleMut.isPending}
              onClick={() => assembleMut.mutate()}
            >
              Собрать корзину
            </Button>
          </section>
          {assembleMut.isError && (
            <p className="text-sm text-error-primary">
              Не удалось собрать: {assembleMut.error instanceof Error ? assembleMut.error.message : 'ошибка'}
            </p>
          )}

          {cartQuery.isLoading && <p className="text-sm text-tertiary">Загрузка корзины…</p>}
          {!cartQuery.isLoading && items.length === 0 && (
            <p className="text-sm text-tertiary">
              Корзина пуста. Укажи неделю с готовым планом и нажми «Собрать корзину».
            </p>
          )}

          {items.length > 0 && (
            <section className="flex flex-col gap-4">
              <div className="flex items-baseline justify-between">
                <h2 className="text-lg font-semibold text-primary">Корзина</h2>
                <span className="text-sm text-tertiary">≈ {Math.round(total)} ₽ · {items.length} позиций</span>
              </div>

              {shops.map((shop) => {
                const shopItems = items.filter((i) => i.shop === shop);
                const shopTotal = shopItems.reduce((a, i) => a + lineCost(i), 0);
                return (
                  <div key={shop} className="overflow-hidden rounded-xl border border-secondary">
                    <div className="flex items-baseline justify-between bg-secondary px-4 py-2.5">
                      <span className="text-sm font-medium text-primary">{SHOP_LABEL[shop] ?? shop}</span>
                      <span className="text-xs text-tertiary">≈ {Math.round(shopTotal)} ₽</span>
                    </div>
                    <ul>
                      {shopItems.map((i) => (
                        <li
                          key={i.id}
                          className="flex items-center justify-between border-t border-secondary px-4 py-2.5 text-sm"
                        >
                          <span className="text-primary">{i.ingredient?.name ?? i.ingredient?.id ?? '—'}</span>
                          <span className="text-secondary">
                            {i.qtyG} г · ≈ {Math.round(lineCost(i))} ₽
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}

              <div>
                <Button
                  color="primary"
                  size="md"
                  isLoading={orderMut.isPending}
                  onClick={() => orderMut.mutate()}
                >
                  Оформить заказ
                </Button>
              </div>
              {orderMut.isError && (
                <p className="text-sm text-error-primary">
                  Не удалось оформить: {orderMut.error instanceof Error ? orderMut.error.message : 'ошибка'}
                </p>
              )}
            </section>
          )}

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold text-primary">История заказов</h2>
            {orders.length === 0 && <p className="text-sm text-tertiary">Заказов пока нет.</p>}
            <ul className="flex flex-col gap-2">
              {orders.map((o) => (
                <li
                  key={o.id}
                  className="flex items-center justify-between rounded-lg border border-secondary bg-primary px-4 py-3 text-sm"
                >
                  <div className="flex flex-col">
                    <span className="font-medium text-primary">{SHOP_LABEL[o.shop] ?? o.shop}</span>
                    <span className="text-xs text-tertiary">
                      {o.orderedAt.slice(0, 10)} · {o.items.length} позиций · {o.status}
                    </span>
                  </div>
                  {o.totalRub && <span className="text-secondary">{Math.round(Number(o.totalRub))} ₽</span>}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </main>
  );
}
