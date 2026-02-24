# Multi-stage build for DS Agent Dashboard (Nginx serves frontend + proxies to separate server)
FROM node:18-alpine AS base

# Install dependencies
FROM base AS deps
WORKDIR /app

COPY package*.json ./
COPY turbo.json ./
COPY packages/dashboard/package*.json ./packages/dashboard/

RUN npm install

# Build stage
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/dashboard/node_modules ./packages/dashboard/node_modules

COPY package*.json ./
COPY turbo.json ./
COPY tsconfig.json ./
COPY packages/dashboard ./packages/dashboard

# Build args for environment variables
ARG VITE_API_URL
ARG VITE_WS_URL

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL

RUN npm run build --workspace=@ds-agent/dashboard

# Production - Nginx
FROM nginx:alpine AS runner

# Copy nginx config that proxies API to external server
COPY packages/dashboard/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built files
COPY --from=builder /app/packages/dashboard/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
