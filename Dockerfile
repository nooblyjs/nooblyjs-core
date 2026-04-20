# ============================================================================
# Noobly JS Core - Production Docker Image
# ============================================================================
# Uses Node 18-alpine for security and small image size
# Follows Docker and Kubernetes best practices
# ============================================================================

# Stage 1: Build and dependency installation
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /build

# Install security updates
RUN apk update && apk add --no-cache ca-certificates

# Copy package files
COPY package*.json ./

# Install dependencies using npm ci for reproducible builds
# Only install production dependencies
RUN npm ci --only=production

# ============================================================================
# Stage 2: Runtime image (minimal)
# ============================================================================
FROM node:18-alpine

# Add security metadata
LABEL maintainer="Noobly JS Team" \
      description="Noobly JS Core - Modular Node.js Backend Services" \
      version="1.0.0"

# Set NODE_ENV to production
ENV NODE_ENV=production

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy built dependencies from builder stage
COPY --from=builder --chown=nodejs:nodejs /build/node_modules ./node_modules

# Copy application source code
COPY --chown=nodejs:nodejs . .

# Create application directories with correct permissions
RUN mkdir -p ./.application/logs ./.application/data && \
    chown -R nodejs:nodejs ./.application

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 11000

# Health check for Docker
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:11000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start application with proper signal handling
CMD ["node", "app.js"]