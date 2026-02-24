FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/server/package*.json ./packages/server/

# Install dependencies
RUN npm ci --workspace=@ds-agent/server

# Build stage
FROM base AS builder
WORKDIR /app

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/server/node_modules ./packages/server/node_modules

# Copy source code
COPY package*.json ./
COPY turbo.json ./
COPY tsconfig.json ./
COPY packages/server ./packages/server
COPY .ds-agent ./.ds-agent

# Build server
RUN npm run build --workspace=@ds-agent/server

# Production stage
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs

# Copy built files
COPY --from=builder --chown=nodejs:nodejs /app/packages/server/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/packages/server/package*.json ./
COPY --from=builder --chown=nodejs:nodejs /app/.ds-agent ./.ds-agent

# Install production dependencies only
RUN npm ci --only=production

USER nodejs

EXPOSE 3000

CMD ["node", "dist/index.js"]
