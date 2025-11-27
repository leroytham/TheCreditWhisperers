# =============================================================================
# TheCreditWhisperers - Frontend Microservice
# =============================================================================
# Nginx-based container for serving React SPA with API proxying
# Demonstrates microservices architecture with frontend/backend separation
#
# Features:
# - Multi-stage build for minimal image size
# - nginx:alpine for production-ready serving
# - API proxy to backend service
# - WebSocket proxy support
# - Health check endpoint
#
# Usage:
#   docker build -t creditwhisperers/frontend:latest ./frontend
#   docker run -p 3000:80 creditwhisperers/frontend:latest

# -----------------------------------------------------------------------------
# Stage 1: Build React Application
# -----------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./

# Install dependencies (using ci for reproducible builds)
RUN npm ci --silent

# Copy source code
COPY . .

# Build the React application for production
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 2: Production nginx Server
# -----------------------------------------------------------------------------
FROM nginx:alpine

# Labels for container metadata
LABEL org.opencontainers.image.title="TheCreditWhisperers Frontend"
LABEL org.opencontainers.image.description="React SPA served by nginx with API proxy"
LABEL org.opencontainers.image.vendor="TheCreditWhisperers"

# Copy built React app to nginx html directory
COPY --from=builder /app/build /usr/share/nginx/html

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Expose port 80
EXPOSE 80

# Health check for container orchestration
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget -q --spider http://localhost/health || exit 1

# Run nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
