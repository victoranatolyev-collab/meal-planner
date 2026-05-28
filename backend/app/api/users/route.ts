import { NextResponse } from 'next/server';
import { listUsers } from 'core';

/**
 * GET /api/users
 * Список пользователей. Frontend (auth отложена) использует первого как текущего.
 * Ответ: { items: [{ id, email, createdAt }], total }
 */
export async function GET() {
  const result = await listUsers();
  return NextResponse.json(result);
}
