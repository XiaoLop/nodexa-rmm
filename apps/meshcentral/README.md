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

## YAML Overrides

Pass a YAML file to merge it with `src/config.default.json` before starting MeshCentral:

```text
pnpm --filter @meshcentral/server dev -- --config-yaml /absolute/path/config.yaml
```

```yaml
settings:
	cert: mesh.example.com
	tlsOffload: false
domains:
	'':
		title: My MeshCentral
```

Objects merge recursively, including the empty default domain key. Arrays are replaced in full.
Explicit `false`, `0`, empty strings and `null` replace defaults; `settings` and `domains` must
remain objects. An empty YAML file uses all defaults. Invalid YAML, duplicate keys and conflicting
configuration arguments stop startup. Native advanced fields are preserved, but their full semantics
are still validated by MeshCentral itself.

`--configfile config.yaml` and `--configfile=config.yml` also enable merging. A native JSON
`--configfile` is forwarded unchanged, and omitting configuration arguments preserves native startup.
The generated JSON is written to a private temporary directory and removed on normal launcher exit.
Neither the defaults nor the input file is modified. Restart the service to apply YAML changes.

For Docker, mount YAML read-only and override the container command, for example:

```yaml
volumes:
	- ./config.yaml:/etc/meshcentral/config.yaml:ro
command:
	- --config-yaml
	- /etc/meshcentral/config.yaml
	- --datapath
	- /var/lib/meshcentral/data
```

Keep the existing persistent data mounts alongside this configuration mount. Rebuild the image
after updating this launcher. The existing development Compose still mounts a native JSON file;
setting its host source to YAML alone is insufficient because its container path ends in `.json`.
Update both its mount and command as shown above.

The defaults contain development database credentials and TLS-offload settings. Override them for
production; YAML merging does not provision MongoDB users, TLS certificates or Docker port mappings.

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
