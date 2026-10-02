# NooblyJS Core — production image.
# Node 24 is the Active LTS line (Node 20 reached end-of-life on 2026-04-30).
FROM node:24-alpine AS builder

WORKDIR /usr/src/app

# Install production dependencies first (better layer caching)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy application source
COPY app.js index.js ./
COPY src/ ./src/
COPY public/ ./public/

FROM node:24-alpine

ENV NODE_ENV=production \
    PORT=9000

# Security: run as non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /usr/src/app

COPY --from=builder --chown=appuser:appgroup /usr/src/app .

# Runtime data (logs, users, sessions, uploaded files). Mount a volume here to
# keep it across container restarts.
RUN mkdir -p .application && chown appuser:appgroup .application
VOLUME ["/usr/src/app/.application"]

USER appuser

EXPOSE 9000

# Liveness check against the built-in health endpoint (busybox wget).
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/health/live" >/dev/null || exit 1

CMD ["node", "app.js"]
