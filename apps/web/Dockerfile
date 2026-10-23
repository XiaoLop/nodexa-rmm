FROM node:22-bookworm-slim AS builder

WORKDIR /workspace

RUN corepack enable && corepack prepare pnpm@10.33.4 --activate

COPY . .

RUN CI=true pnpm install --frozen-lockfile --prod=false \
    && pnpm --filter @meshcentral/web build

FROM nginx:1.29-alpine AS runtime

COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /workspace/apps/web/dist /usr/share/nginx/html

EXPOSE 80