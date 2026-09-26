# MeshCentral Gateway

NestJS Gateway for Web client authentication and health checks.

## Development

Set the variables from `.env.example`, then run:

```text
pnpm dev:gateway
pnpm dev:web
```

The Web development server proxies `/api` to `http://localhost:3000` by default. Set `GATEWAY_DEV_PROXY_TARGET` for a different local Gateway address.

During development the login request flow is:

```text
Browser http://localhost:5173/api/*
	-> Vite proxy http://localhost:3000/api/*
	-> Gateway login endpoint
	-> MeshCentral login endpoint
```

Configure the MeshCentral login endpoint in the Gateway `.env` through `MESH_CENTRAL_BASE_URL`.

## Production

Serve the built Web files and proxy the Gateway HTTP routes under the same public origin. The reverse proxy must not strip the `/api` prefix.

```nginx
location /api/ {
	proxy_pass http://gateway:3000;
	proxy_http_version 1.1;
	proxy_set_header Host $host;
	proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
	proxy_set_header X-Forwarded-Proto $scheme;
}
```

Set `GATEWAY_PUBLIC_ORIGIN` to the public Web origin, for example `https://console.example.com`, and set `GATEWAY_TRUST_PROXY=1` when there is one trusted reverse proxy layer.

## Routes

- `POST /api/login`
- `GET /api/docs` (Swagger UI)
- `GET /api/docs-json` (OpenAPI JSON)
- `GET /health/live`
- `GET /health/ready`

The login endpoint returns a candidate result. The Gateway never logs or stores submitted credentials or upstream cookies.
