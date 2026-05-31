import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fetchDiary, createDiaryEntry } from './diary';
import { fetchStock } from './stock';
import { assembleCart, fetchCart } from './cart';
import { fetchOrders, placeOrder } from './orders';
import { generatePlan, fetchPlans } from './plans';
import { postAgentMessage, fetchAgentHistory } from './agent';
import { fetchIngredients } from './ingredients';

function res(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue(res({}));
  vi.stubGlobal('fetch', fetchMock);
});

function lastCall() {
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit | undefined];
  return { url, init };
}

describe('GET clients build correct URLs', () => {
  it('fetchDiary', async () => {
    await fetchDiary('u-1');
    expect(lastCall().url).toBe('/api/diary?userId=u-1');
  });
  it('fetchStock', async () => {
    await fetchStock('u-1');
    expect(lastCall().url).toBe('/api/stock?userId=u-1');
  });
  it('fetchOrders', async () => {
    await fetchOrders('u-1');
    expect(lastCall().url).toBe('/api/orders?userId=u-1');
  });
  it('fetchPlans', async () => {
    await fetchPlans('u-1');
    expect(lastCall().url).toBe('/api/plans?userId=u-1');
  });
  it('fetchAgentHistory', async () => {
    await fetchAgentHistory('u-1');
    expect(lastCall().url).toBe('/api/agent/history?userId=u-1');
  });
  it('fetchIngredients', async () => {
    await fetchIngredients();
    expect(lastCall().url).toBe('/api/ingredients?limit=200');
  });
});

describe('POST clients send method + body', () => {
  it('createDiaryEntry', async () => {
    fetchMock.mockResolvedValue(res({ id: 'd1' }));
    await createDiaryEntry({ userId: 'u-1', customName: 'Банан', portionFactor: 2 });
    const { url, init } = lastCall();
    expect(url).toBe('/api/diary');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toMatchObject({ userId: 'u-1', customName: 'Банан', portionFactor: 2 });
  });
  it('assembleCart', async () => {
    fetchMock.mockResolvedValue(res({ cartId: 'c1', byShop: {} }, 201));
    await assembleCart('u-1', '2026-W22');
    const { url, init } = lastCall();
    expect(url).toBe('/api/cart/assemble');
    expect(JSON.parse(String(init?.body))).toEqual({ userId: 'u-1', weekIso: '2026-W22' });
  });
  it('placeOrder', async () => {
    fetchMock.mockResolvedValue(res({ orders: [] }, 201));
    await placeOrder('u-1');
    const { url, init } = lastCall();
    expect(url).toBe('/api/orders');
    expect(JSON.parse(String(init?.body))).toEqual({ userId: 'u-1' });
  });
  it('generatePlan (omits dayCount when absent)', async () => {
    fetchMock.mockResolvedValue(res({ weekIso: '2026-W22', days: 7 }, 201));
    await generatePlan('u-1', '2026-W22', '2026-05-25');
    const body = JSON.parse(String(lastCall().init?.body));
    expect(body).toEqual({ userId: 'u-1', weekIso: '2026-W22', startDate: '2026-05-25' });
  });
  it('generatePlan (includes dayCount when given)', async () => {
    fetchMock.mockResolvedValue(res({}, 201));
    await generatePlan('u-1', '2026-W22', '2026-05-25', 5);
    expect(JSON.parse(String(lastCall().init?.body)).dayCount).toBe(5);
  });
  it('postAgentMessage', async () => {
    fetchMock.mockResolvedValue(res({ reply: 'ok', intent: null, toolResults: [] }));
    await postAgentMessage('u-1', 'привет');
    const { url, init } = lastCall();
    expect(url).toBe('/api/agent/message');
    expect(JSON.parse(String(init?.body))).toEqual({ userId: 'u-1', message: 'привет' });
  });
});

describe('fetchCart 404 handling', () => {
  it('returns null on 404', async () => {
    fetchMock.mockResolvedValue(res({ error: 'not_found' }, 404));
    await expect(fetchCart('u-1')).resolves.toBeNull();
  });
  it('returns cart on 200', async () => {
    fetchMock.mockResolvedValue(res({ id: 'c1', status: 'ACTIVE', items: [] }));
    await expect(fetchCart('u-1')).resolves.toMatchObject({ id: 'c1' });
  });
});
