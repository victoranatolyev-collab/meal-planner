# Frontend Dockerfile (Vite/React SPA → nginx).
# Context: корень монорепо (App/).

# ============ deps ============
FROM node:22-alpine AS deps
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
COPY frontend ./frontend
WORKDIR /repo/frontend
RUN npm run build

# ============ runner (nginx serve static + proxy /api) ============
FROM nginx:1.27-alpine AS runner
COPY --from=builder /repo/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
