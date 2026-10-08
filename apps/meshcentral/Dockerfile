FROM node:22-bookworm-slim AS builder

ARG MESHCENTRAL_VERSION=1.1.54

WORKDIR /workspace

RUN corepack enable && corepack prepare pnpm@10.33.4 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/meshcentral/package.json apps/meshcentral/tsconfig.json apps/meshcentral/tsconfig.build.json ./apps/meshcentral/
COPY packages/meshcentral-plugins/package.json packages/meshcentral-plugins/tsconfig.json ./packages/meshcentral-plugins/

RUN pnpm install --frozen-lockfile --filter @meshcentral/server... --filter @meshcentral/plugins...

COPY apps/meshcentral/src ./apps/meshcentral/src
COPY packages/meshcentral-plugins/scripts ./packages/meshcentral-plugins/scripts
COPY packages/meshcentral-plugins/src ./packages/meshcentral-plugins/src

ADD https://raw.githubusercontent.com/Ylianst/MeshCentral/1.1.54/exeHandler.js /tmp/exeHandler.js

RUN pnpm --filter @meshcentral/plugins build \
    && pnpm --filter @meshcentral/server build \
    && pnpm --filter @meshcentral/server deploy --legacy --prod /app \
    && test "$(node -p "require('/app/node_modules/meshcentral/package.json').version")" = "$MESHCENTRAL_VERSION" \
    && meshcentral_dir="$(dirname "$(node -p "require.resolve('/app/node_modules/meshcentral/meshcentral.js')")")" \
    && cp /tmp/exeHandler.js "$meshcentral_dir/exeHandler.js" \
    && node -e "require.resolve('/app/node_modules/meshcentral/meshcentral.js')" \
    && node -e "require.resolve('/app/node_modules/meshcentral/exeHandler.js')" \
    && cd "$meshcentral_dir" \
    && node -e "require.resolve('image-size')" \
    && node -e "require.resolve('mongodb')" \
    && node -e "require.resolve('@mongodb-js/saslprep')"

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends gosu \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder --chown=node:node /app /app
COPY --from=builder --chown=node:node /workspace/apps/meshcentral/runtime/data/plugins /opt/meshcentral-plugins
COPY --chown=node:node apps/meshcentral/docker-entrypoint.sh /usr/local/bin/meshcentral-entrypoint

RUN mkdir -p \
      /run/config \
      /var/lib/meshcentral/data \
      /var/lib/meshcentral/files \
      /var/lib/meshcentral/backups \
      /var/lib/meshcentral/recordings \
    && chmod +x /usr/local/bin/meshcentral-entrypoint \
    && chown -R node:node /run/config /var/lib/meshcentral /opt/meshcentral-plugins

EXPOSE 8443

ENTRYPOINT ["meshcentral-entrypoint", "node", "dist/main.js"]
CMD ["--configfile", "/run/config/meshcentral.json", "--datapath", "/var/lib/meshcentral/data"]