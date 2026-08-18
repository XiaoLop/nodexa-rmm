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

  it('parses MeshCentral real nodes response (Record<string, Device[]>) and _id field', () => {
    const store = createGatewayStore();
    const meshCentralNodesPayload = {
      action: 'nodes',
      responseid: 'req-nodes',
      nodes: {
        'mesh/domain/group1': [
          { _id: 'node/domain/device1', name: 'Web Server', conn: 1 },
          { _id: 'node/domain/device2', name: 'DB Server', conn: 0 },
        ],
      },
    };
    for (const mutation of meshCentralGatewayAdapter.decode(meshCentralNodesPayload)) {
      store.getState().applyMutation(mutation);
    }
    const devices = gatewaySelectors.devices(store.getState());
    expect(devices).toHaveLength(2);
    expect(devices[0]).toMatchObject({ id: 'node/domain/device1', name: 'Web Server', online: true, groupId: 'mesh/domain/group1' });
    expect(devices[1]).toMatchObject({ id: 'node/domain/device2', name: 'DB Server', online: false, groupId: 'mesh/domain/group1' });
  });

  it('parses MeshCentral real meshes response (DeviceGroup[]) and _id field', () => {
    const store = createGatewayStore();
    const meshCentralMeshesPayload = {
      action: 'meshes',
      responseid: 'req-groups',
      meshes: [
        { _id: 'mesh/domain/group1', name: 'Production', desc: 'Prod Servers' },
      ],
    };
    for (const mutation of meshCentralGatewayAdapter.decode(meshCentralMeshesPayload)) {
      store.getState().applyMutation(mutation);
    }
    const groups = gatewaySelectors.groups(store.getState());
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ id: 'mesh/domain/group1', name: 'Production', description: 'Prod Servers' });
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
