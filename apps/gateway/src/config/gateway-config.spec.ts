import { describe, expect, it } from 'vitest';

import { buildUpstreamUrl, loadGatewayConfig } from './gateway-config';

describe('loadGatewayConfig', () => {
  it('normalizes a MeshCentral domain path', () => {
    const config = loadGatewayConfig({
      NODE_ENV: 'development',
      MESH_CENTRAL_BASE_URL: 'http://127.0.0.1:8443',
      MESH_CENTRAL_DOMAIN_PATH: 'customer-a',
      GATEWAY_PUBLIC_ORIGIN: 'http://localhost:5173',
    });

    expect(config.domainPath).toBe('/customer-a/');
    expect(buildUpstreamUrl(config, '/control.ashx').href).toBe(
      'http://127.0.0.1:8443/customer-a/control.ashx',
    );
  });

  it('rejects credentials and query parameters in the upstream origin', () => {
    expect(() =>
      loadGatewayConfig({
        MESH_CENTRAL_BASE_URL: 'https://user:secret@mesh.example.com/?target=other',
        GATEWAY_PUBLIC_ORIGIN: 'https://console.example.com',
      }),
    ).toThrow(/without credentials/);
  });

  it('requires HTTPS and a public origin in production', () => {
    expect(() =>
      loadGatewayConfig({
        NODE_ENV: 'production',
        MESH_CENTRAL_BASE_URL: 'http://mesh.example.com',
        GATEWAY_PUBLIC_ORIGIN: 'https://console.example.com',
      }),
    ).toThrow(/HTTPS/);

    expect(() =>
      loadGatewayConfig({
        NODE_ENV: 'production',
        MESH_CENTRAL_BASE_URL: 'https://mesh.example.com',
      }),
    ).toThrow(/GATEWAY_PUBLIC_ORIGIN/);
  });
});
