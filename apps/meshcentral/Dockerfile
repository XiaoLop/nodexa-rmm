FROM node:22-bookworm-slim AS builder

# Optional override kept for existing deploy scripts and compose build args. The pinned
# version in apps/meshcentral/package.json remains the source of truth: when this argument
# is provided it must match, otherwise the build fails.
ARG MESHCENTRAL_VERSION=""

WORKDIR /workspace

RUN corepack enable && corepack prepare pnpm@10.33.4 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/meshcentral/patches ./apps/meshcentral/patches/
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

# Verify resolution after copying into the final image, using the runtime user and
# the launcher's module location rather than an absolute builder-stage path.
USER node
RUN node -e "const { createRequire } = require('node:module'); const r = createRequire('/app/dist/main.js'); const expected = r('/app/package.json').dependencies.meshcentral; if (r('meshcentral/package.json').version !== expected) throw new Error('MeshCentral version mismatch'); console.log(r.resolve('meshcentral/meshcentral.js')); r.resolve('meshcentral/exeHandler.js');" \
    && node -e "const fs = require('node:fs'); const path = require('node:path'); const entry = require.resolve('meshcentral/meshcentral.js'); const root = path.resolve(path.dirname(entry), '../..'); for (const [name, version] of Object.entries({'image-size':'2.0.2', 'mongodb':'4.17.2', '@mongodb-js/saslprep':'1.3.1'})) { const pkg = JSON.parse(fs.readFileSync(path.join(root, 'node_modules', name, 'package.json'), 'utf8')); if (pkg.version !== version) throw new Error(name + ' version mismatch'); }" \
    && node dist/main.js --help
USER root

EXPOSE 8443

ENTRYPOINT ["meshcentral-entrypoint", "node", "dist/main.js"]
CMD ["--configfile", "/run/config/meshcentral.json", "--datapath", "/var/lib/meshcentral/data"]
