# ==============================================================================
# @file Dockerfile
# @responsibility Imagem Docker multi-stage de produção para o repositório qta-nc-auditor-senai (Express + Vite SPA + Motor CV RGBA).
# @version 1.0.0
# @date 2026-11-15
# @directory /Dockerfile
# @signature PO Zeh Sobrinho & Senior Agile DevOps Team (AI Framework)
# ==============================================================================

FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .
RUN npm run lint && npm run build

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV DISABLE_HMR=true

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/server ./server
COPY --from=builder /app/src ./src
COPY --from=builder /app/public ./public
COPY --from=builder /app/tsconfig.json ./tsconfig.json

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null 2>&1 || exit 1

CMD ["./node_modules/.bin/tsx", "server.ts"]
