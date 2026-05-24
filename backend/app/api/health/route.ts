import { NextResponse } from 'next/server';

/**
 * Health check endpoint.
 *
 * GET /api/health → 200 { status: 'ok', time: ISO, version: package.json }
 *
 * Используется для readiness/liveness probes в docker-compose и в e2e-тестах.
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    time: new Date().toISOString(),
    version: process.env.npm_package_version ?? '0.0.0',
  });
}
