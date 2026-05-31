import { ApiError, apiGet, apiPost } from './client';

export interface CartItemDto {
  id: string;
  qtyG: number;
  shop: string;
  ingredient: { id: string; name: string; source: string; pricePer100g: string | null } | null;
}

export interface CartDto {
  id: string;
  status: string;
  items: CartItemDto[];
}

export interface AssembleResult {
  cartId: string;
  byShop: Record<string, number>;
}

export const assembleCart = (userId: string, weekIso: string) =>
  apiPost<AssembleResult>('/cart/assemble', { userId, weekIso });

export async function fetchCart(userId: string): Promise<CartDto | null> {
  try {
    return await apiGet<CartDto>(`/cart?userId=${encodeURIComponent(userId)}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}
