import { GatewayClient } from '@meshcentral/control-client';
import { RelayClient } from '@meshcentral/relay';
import { createGatewayStore } from '@meshcentral/shared-state';
import { describe, expect, it } from 'vitest';

describe('workspace packages', () => {
  it('resolves their public entry points', () => {
    expect(GatewayClient).toBeTypeOf('function');
    expect(RelayClient).toBeTypeOf('function');
    expect(createGatewayStore).toBeTypeOf('function');
  });
});