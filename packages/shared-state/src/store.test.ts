import { describe, expect, it } from 'vitest';
import { meshCentralGatewayAdapter } from './protocol';
import { createGatewayStore, gatewaySelectors } from './store';

describe('gateway store and protocol', () => {
  it('applies snapshots and device events', () => {
    const store = createGatewayStore();
    for (const mutation of meshCentralGatewayAdapter.decode({
      type: 'snapshot',
      devices: [{ id: 'node-1', name: 'Server 1', online: false }],
      groups: [{ id: 'group-1', name: 'Servers' }],
    })) {
      store.getState().applyMutation(mutation);
    }

    expect(store.getState().devices['node-1']?.online).toBe(false);
    expect(store.getState().groups['group-1']?.name).toBe('Servers');

    for (const mutation of meshCentralGatewayAdapter.decode({
      type: 'event',
      action: 'nodeconnect',
      nodeid: 'node-1',
      msg: 'Agent connected',
    })) {
      store.getState().applyMutation(mutation);
    }

    expect(store.getState().devices['node-1']).toMatchObject({ name: 'Server 1', online: true });
    expect(store.getState().events[0]?.type).toBe('deviceOnline');
  });

  it('removes devices from remove events', () => {
    const store = createGatewayStore();
    store.getState().upsertDevice({ id: 'node-2', name: 'Server 2', online: true });
    for (const mutation of meshCentralGatewayAdapter.decode({
      type: 'event',
      action: 'removenode',
      nodeid: 'node-2',
    })) {
      store.getState().applyMutation(mutation);
    }
    expect(store.getState().devices['node-2']).toBeUndefined();
  });

  it('returns stable collection selector snapshots until their records change', () => {
    const store = createGatewayStore();
    const initialState = store.getState();

    expect(gatewaySelectors.devices(initialState)).toBe(gatewaySelectors.devices(initialState));
    expect(gatewaySelectors.groups(initialState)).toBe(gatewaySelectors.groups(initialState));

    const initialDevices = gatewaySelectors.devices(initialState);
    store.getState().upsertDevice({ id: 'node-3', name: 'Server 3', online: true });

    expect(gatewaySelectors.devices(store.getState())).not.toBe(initialDevices);
  });
});
