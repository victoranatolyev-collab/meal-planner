# Worker Dockerfile (Node.js + node-cron).

# ============ deps ============
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /repo
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
COPY worker/package.json ./worker/
RUN npm ci --workspaces --include-workspace-root

# ============ builder ============
FROM node:22-alpine AS builder
WORKDIR /repo
COPY --from=deps /repo/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY worker ./worker
WORKDIR /repo/worker
RUN npm run build

# ============ runner ============
FROM node:22-alpine AS runner
RUN apk add --no-cache libc6-compat openssl tini
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 worker

COPY --from=builder --chown=worker:nodejs /repo/worker/dist ./dist
COPY --from=builder --chown=worker:nodejs /repo/worker/package.json ./package.json
COPY --from=builder --chown=worker:nodejs /repo/node_modules ./node_modules

USER worker
# tini как PID 1 — корректная обработка SIGTERM в контейнере
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
