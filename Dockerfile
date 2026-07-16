# syntax=docker/dockerfile:1.7
FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 \
  NPM_CONFIG_AUDIT=false \
  NPM_CONFIG_FUND=false \
  NPM_CONFIG_FETCH_RETRIES=5 \
  NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=10000 \
  NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=120000 \
  NPM_CONFIG_MAXSOCKETS=5

FROM base AS deps
COPY package.json package-lock.json ./
RUN --mount=type=cache,id=nexusflow-npm,target=/root/.npm,sharing=locked \
  set -eu; \
  attempt=1; \
  while [ "$attempt" -le 3 ]; do \
    echo "npm ci attempt $attempt/3"; \
    if npm ci --prefer-offline; then \
      break; \
    fi; \
    if [ "$attempt" -eq 3 ]; then \
      echo "npm ci failed after 3 attempts" >&2; \
      exit 1; \
    fi; \
    npm cache clean --force || true; \
    attempt=$((attempt + 1)); \
    sleep $((attempt * 5)); \
  done

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY next.config.ts tsconfig.json next-env.d.ts postcss.config.mjs tailwind.config.ts components.json ./
COPY src ./src
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production \
  TRANSFORMERS_CACHE_DIR=/tmp/transformers-cache \
  HOME=/home/nextjs \
  NPM_CONFIG_CACHE=/tmp/.npm \
  LD_LIBRARY_PATH=/app/node_modules/onnxruntime-node/bin/napi-v3/linux/x64:/app/node_modules/onnxruntime-node/bin/napi-v3/linux/arm64

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

RUN mkdir -p /tmp/transformers-cache /tmp/.npm /home/nextjs \
  && chown -R nextjs:nodejs /tmp/transformers-cache /tmp/.npm /home/nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/onnxruntime-node ./node_modules/onnxruntime-node

EXPOSE 9967
USER nextjs

CMD ["node", "server.js"]
