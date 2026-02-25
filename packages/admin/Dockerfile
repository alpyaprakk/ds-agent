FROM node:18-alpine AS base

FROM base AS deps
WORKDIR /app

RUN mkdir -p packages/admin

COPY package*.json ./
COPY packages/admin/package*.json ./packages/admin/

RUN npm ci --workspace=@ds-agent/admin

FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/admin/node_modules ./packages/admin/node_modules

COPY package*.json ./
COPY turbo.json ./
COPY packages/admin ./packages/admin

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build --workspace=@ds-agent/admin

FROM nginx:alpine AS runner

COPY packages/admin/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/packages/admin/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
