FROM node:22-bookworm-slim AS builder

WORKDIR /workspace

RUN corepack enable && corepack prepare pnpm@10.33.4 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/site/package.json ./apps/site/
RUN pnpm install --frozen-lockfile --filter @meshcentral/site...

COPY apps/site ./apps/site

ARG NEXT_PUBLIC_SITE_URL="http://localhost:3000"
ARG NEXT_PUBLIC_CONSOLE_URL=""
ARG NEXT_PUBLIC_CONTACT_EMAIL=""
ARG NEXT_PUBLIC_CONTACT_TELEGRAM=""
ARG NEXT_PUBLIC_CONTACT_WECHAT=""
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_CONSOLE_URL=$NEXT_PUBLIC_CONSOLE_URL \
    NEXT_PUBLIC_CONTACT_EMAIL=$NEXT_PUBLIC_CONTACT_EMAIL \
    NEXT_PUBLIC_CONTACT_TELEGRAM=$NEXT_PUBLIC_CONTACT_TELEGRAM \
    NEXT_PUBLIC_CONTACT_WECHAT=$NEXT_PUBLIC_CONTACT_WECHAT \
    NEXT_TELEMETRY_DISABLED=1

RUN pnpm --filter @meshcentral/site build

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

WORKDIR /app

COPY --from=builder --chown=node:node /workspace/apps/site/.next/standalone ./
COPY --from=builder --chown=node:node /workspace/apps/site/.next/static ./apps/site/.next/static
COPY --from=builder --chown=node:node /workspace/apps/site/public ./apps/site/public

USER node
EXPOSE 3000

CMD ["node", "apps/site/server.js"]