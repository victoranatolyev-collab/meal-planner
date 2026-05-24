# Backend Dockerfile (Next.js 15).
# Context: корень монорепо (App/), чтобы npm workspaces работали.
# Стратегия: multi-stage с standalone output Next.js — итоговый образ маленький.

# ============ deps ============
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /repo

# Копируем корневой workspace package.json + lockfile + папки workspaces с package.json
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
COPY worker/package.json ./worker/

# Устанавливаем все зависимости (npm workspaces подхватит)
RUN npm ci --workspaces --include-workspace-root

# ============ builder ============
FROM node:22-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /repo

COPY --from=deps /repo/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY backend ./backend

# Prisma generate (нужен schema.prisma в backend/prisma)
WORKDIR /repo/backend
RUN npx prisma generate
RUN npm run build

# ============ runner ============
FROM node:22-alpine AS runner
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Создаём non-root пользователя для безопасности
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

# Копируем артефакты сборки. Используем стандартный (не standalone) выход:
# нужны .next + node_modules + package.json + prisma (для migrate deploy).
COPY --from=builder --chown=nextjs:nodejs /repo/backend/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /repo/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /repo/backend/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /repo/backend/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /repo/backend/next.config.ts ./next.config.ts

USER nextjs
EXPOSE 3000
ENV PORT=3000

CMD ["npx", "next", "start", "-p", "3000"]
