# MeshCentral Server

Workspace application that pins and runs the upstream MeshCentral package.

The upstream dependency is pinned to version `1.2.5` so server upgrades remain explicit and
repeatable.

## Development

```text
pnpm --filter @meshcentral/server dev
```

Additional command-line arguments are forwarded to MeshCentral.

```text
pnpm --filter @meshcentral/server dev -- --help
```

The upstream `1.2.5` npm archive currently omits `exeHandler.js`, so the server image must restore
that upstream runtime file during the Docker build before this launcher can start MeshCentral.

Project-level configuration generation and Docker deployment will be added separately.
