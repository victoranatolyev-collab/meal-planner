import { PrismaClient } from '@prisma/client';

// Singleton Prisma client.
// В dev Next.js делает hot-reload и каждый раз создаёт новый клиент → у Postgres кончаются
// соединения. Поэтому в dev держим клиент в globalThis.
// В prod создаём один раз при импорте модуля.

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env['NODE_ENV'] === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env['NODE_ENV'] !== 'production') {
  globalForPrisma.prisma = prisma;
}
