# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy all package files
COPY package*.json ./
COPY turbo.json ./
COPY tsconfig.json ./
COPY packages/dashboard/package*.json ./packages/dashboard/

# Install all dependencies
RUN npm install

# Copy source code
COPY packages/dashboard ./packages/dashboard

# Build args for environment variables
ARG VITE_API_URL
ARG VITE_WS_URL

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL

# Build dashboard
RUN npm run build --workspace=@ds-agent/dashboard

# Production stage - Nginx
FROM nginx:alpine

# Copy nginx config
COPY packages/dashboard/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built files from builder
COPY --from=builder /app/packages/dashboard/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
