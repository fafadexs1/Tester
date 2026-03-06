FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS prod-deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM base AS runner
ENV NODE_ENV=production \
  TRANSFORMERS_CACHE_DIR=/tmp/transformers-cache \
  HOME=/home/nextjs \
  NPM_CONFIG_CACHE=/tmp/.npm

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs
RUN mkdir -p /tmp/transformers-cache /tmp/.npm /home/nextjs /app/.next/cache \
  && chown -R nextjs:nodejs /tmp/transformers-cache /tmp/.npm /home/nextjs /app

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=deps /app/node_modules/typescript ./node_modules/typescript
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts

RUN chown -R nextjs:nodejs /app

EXPOSE 9967
USER nextjs

CMD ["./node_modules/.bin/next", "start", "-H", "0.0.0.0", "-p", "9967"]

