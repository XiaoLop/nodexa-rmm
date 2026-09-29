# MeshCentral Business Gateway

NestJS service reserved as a future business aggregation layer. It currently provides an experimental login adapter, Swagger, and health checks, but it is not part of the Web or App production authentication, control, or Relay path.

Production authentication is handled by the `jsonauth` plugin running inside MeshCentral. Nginx routes `/api/auth/*`, `/api/control.ashx`, and `/api/meshrelay.ashx` directly to MeshCentral so all three paths share the native MeshCentral Session Cookie.

## Development

Set the variables from `.env.example`, then run:

```text
pnpm dev:gateway
pnpm dev:web
```

Run this service only when developing its future aggregation APIs or its experimental login adapter. The main Web development flow does not require it.

The current Web login request flow is:

```text
Browser http://localhost:5173/api/auth/*
 -> Vite proxy
 -> MeshCentral jsonauth plugin
```

`MESH_CENTRAL_BASE_URL` configures the upstream used by the experimental Gateway login adapter only.

## Production

The production Nginx configuration does not route browser authentication, control, or Relay traffic through this service. Deploying the Gateway is optional until a business aggregation API is connected to the product.

If future aggregation routes are exposed, give them a distinct prefix and explicitly add that prefix to Nginx. Do not reuse `/api/auth/*`, `/api/control.ashx`, or `/api/meshrelay.ashx`.

## Routes

- `POST /api/login` (experimental adapter; not used by the current Web/App flow)
- `GET /api/docs` (Swagger UI)
- `GET /api/docs-json` (OpenAPI JSON)
- `GET /health/live`
- `GET /health/ready`

The experimental login endpoint returns a candidate result. The Gateway never logs or stores submitted credentials or upstream cookies.
