FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/dashboard/package*.json ./packages/dashboard/

# Install dependencies
RUN npm ci --workspace=@ds-agent/dashboard

# Build stage
FROM base AS builder
WORKDIR /app

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/dashboard/node_modules ./packages/dashboard/node_modules

# Copy source code
COPY package*.json ./
COPY turbo.json ./
COPY tsconfig.json ./
COPY packages/dashboard ./packages/dashboard

# Build args for environment variables
ARG VITE_API_URL
ARG VITE_WS_URL

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL

# Build dashboard
RUN npm run build --workspace=@ds-agent/dashboard

# Production stage - serve with nginx
FROM nginx:alpine AS runner

# Copy nginx config
COPY packages/dashboard/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built files
COPY --from=builder /app/packages/dashboard/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
