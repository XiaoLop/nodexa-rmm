FROM node:22-bookworm-slim AS builder

# Optional override kept for existing deploy scripts and compose build args. The pinned
# version in apps/meshcentral/package.json remains the source of truth: when this argument
# is provided it must match, otherwise the build fails.
ARG MESHCENTRAL_VERSION=""

WORKDIR /workspace

RUN corepack enable && corepack prepare pnpm@10.33.4 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/meshcentral/package.json apps/meshcentral/tsconfig.json apps/meshcentral/tsconfig.build.json ./apps/meshcentral/
COPY packages/meshcentral-plugins/package.json packages/meshcentral-plugins/tsconfig.json ./packages/meshcentral-plugins/

RUN pnpm install --frozen-lockfile --filter @meshcentral/server... --filter @meshcentral/plugins...

COPY apps/meshcentral/src ./apps/meshcentral/src
COPY packages/meshcentral-plugins/scripts ./packages/meshcentral-plugins/scripts
COPY packages/meshcentral-plugins/src ./packages/meshcentral-plugins/src

# `exeHandler.js` ships inside the pinned `meshcentral` tarball (package.json `files: ["*.js"]`).
# The version below is the single source of truth: `apps/meshcentral/package.json` must pin an
# exact version, and the installed package must match it. No remote download at build time.
RUN pnpm --filter @meshcentral/plugins build \
    && pnpm --filter @meshcentral/server build \
    && pnpm --filter @meshcentral/server deploy --legacy --prod /app \
    && meshcentral_version="$(node -p "require('./apps/meshcentral/package.json').dependencies.meshcentral")" \
    && echo "$meshcentral_version" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$' \
    && { [ -z "$MESHCENTRAL_VERSION" ] || [ "$MESHCENTRAL_VERSION" = "$meshcentral_version" ]; } \
    && test "$(node -p "require('/app/node_modules/meshcentral/package.json').version")" = "$meshcentral_version" \
    && node -e "require.resolve('/app/node_modules/meshcentral/exeHandler.js')" \
    && cd "$(dirname "$(node -p "require.resolve('/app/node_modules/meshcentral/meshcentral.js')")")" \
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