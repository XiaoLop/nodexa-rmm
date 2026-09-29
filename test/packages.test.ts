import { MeshCentralClient } from '@meshcentral/control-client';
import { RelayClient } from '@meshcentral/relay';
import { createMeshCentralControlStore } from '@meshcentral/shared-state';
import { describe, expect, it } from 'vitest';

describe('workspace packages', () => {
  it('resolves their public entry points', () => {
    expect(MeshCentralClient).toBeTypeOf('function');
    expect(RelayClient).toBeTypeOf('function');
    expect(createMeshCentralControlStore).toBeTypeOf('function');
  });
});