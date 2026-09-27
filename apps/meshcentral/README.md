# MeshCentral Server

Workspace application that pins and runs the upstream MeshCentral package.

The upstream dependency is pinned to version `1.1.54` so server upgrades remain explicit and
repeatable.

## Development

```text
pnpm --filter @meshcentral/server dev
```

Additional command-line arguments are forwarded to MeshCentral.

```text
pnpm --filter @meshcentral/server dev -- --help
```

The upstream `1.1.54` npm archive currently omits `exeHandler.js`, so the server image restores
that upstream runtime file during the Docker build before this launcher can start MeshCentral.

## Docker

Manage the development containers from the repository root:

```text
pnpm dev:meshcentral:start
pnpm dev:meshcentral:restart
pnpm dev:meshcentral:stop
pnpm dev:meshcentral:status
pnpm dev:meshcentral:logs
pnpm dev:meshcentral:down
```

`start` reuses the local development image. Build the image after changing the Dockerfile or server
dependencies, or rebuild and start it in one command:

```text
pnpm dev:meshcentral:build
pnpm dev:meshcentral:rebuild
```

The default native MeshCentral configuration is
`deploy/config/meshcentral.example.json`. To use another configuration file, set
`MESHCENTRAL_CONFIG_FILE` to a path relative to `deploy/compose.meshcentral.yaml` or to an absolute
path:

```powershell
$env:MESHCENTRAL_CONFIG_FILE = './config/meshcentral.local.json'
pnpm dev:meshcentral:start
```

Compose mounts the selected file read-only at `/run/config/meshcentral.json` and starts the
workspace launcher with:

```text
--configfile /run/config/meshcentral.json --datapath /var/lib/meshcentral/data
```

MeshCentral listens on `127.0.0.1:8443` on the host for the local Nest Gateway. The sample config
uses TLS offload, so MeshCentral serves HTTP/WS internally and does not generate or load the public
Nginx certificate.
