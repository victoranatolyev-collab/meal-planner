# Worker Dockerfile (Node.js + node-cron).
# Run-time: tsx (worker импортирует TS-исходники из 'core' workspace).
# Trade-off: чуть медленнее старт чем pure Node, но без bundling-шага — KISS.

# ============ deps ============
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /repo
COPY package.json package-lock.json ./
COPY core/package.json ./core/
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
COPY worker/package.json ./worker/
COPY llm-service/package.json ./llm-service/
RUN npm ci --workspaces --include-workspace-root

# ============ prep (prisma client generation для core) ============
FROM node:22-alpine AS prep
RUN apk add --no-cache libc6-compat openssl
WORKDIR /repo
COPY --from=deps /repo/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY core ./core
WORKDIR /repo/core
RUN npx prisma generate

# ============ runner ============
FROM node:22-alpine AS runner
RUN apk add --no-cache libc6-compat openssl tini
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 worker

# Полная установка с tsx и core-source — worker запускается через tsx в prod.
COPY --from=prep --chown=worker:nodejs /repo/node_modules ./node_modules
COPY --from=prep --chown=worker:nodejs /repo/core ./core
COPY --chown=worker:nodejs worker ./worker
COPY --chown=worker:nodejs package.json package-lock.json ./

USER worker
# tini как PID 1 — корректная обработка SIGTERM в контейнере.
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["npx", "tsx", "worker/src/index.ts"]
