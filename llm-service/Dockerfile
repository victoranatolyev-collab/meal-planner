# llm-service Dockerfile. Tsx runtime (как worker).

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

# ============ prep (prisma generate для core) ============
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

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 llm

COPY --from=prep --chown=llm:nodejs /repo/node_modules ./node_modules
COPY --from=prep --chown=llm:nodejs /repo/core ./core
COPY --chown=llm:nodejs llm-service ./llm-service
COPY --chown=llm:nodejs package.json package-lock.json ./

USER llm
EXPOSE 3001
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["npx", "tsx", "llm-service/src/index.ts"]
