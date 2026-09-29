FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Install dependencies first (better layer caching)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy application source
COPY app.js index.js ./
COPY src/ ./src/
COPY public/ ./public/

FROM node:20-alpine

# Security: run as non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /usr/src/app

COPY --from=builder --chown=appuser:appgroup /usr/src/app .

USER appuser

EXPOSE 11000

CMD ["node", "app.js"]
