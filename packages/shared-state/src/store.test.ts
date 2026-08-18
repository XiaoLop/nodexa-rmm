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

  it('ignores ifchange events and does not store them in state', () => {
    const store = createGatewayStore();
    const payloads = [
      {
        action: 'event',
        event: {
          action: 'ifchange',
          etype: 'node',
          nodeid: 'node-1',
        },
      },
      {
        action: 'ifchange',
        nodeid: 'node-1',
      },
      {
        etype: 'ifchange',
        nodeid: 'node-1',
      },
    ];

    for (const payload of payloads) {
      const mutations = meshCentralGatewayAdapter.decode(payload);
      expect(mutations).toHaveLength(0);
      for (const mutation of mutations) {
        store.getState().applyMutation(mutation);
      }
    }
    expect(store.getState().events).toHaveLength(0);
  });

  it('ignores unknown events and does not store them in state', () => {
    const store = createGatewayStore();

    // 1. 测试通过 decode 解码未知 action 消息
    const mutations = meshCentralGatewayAdapter.decode({
      action: 'event',
      event: {
        action: 'someUnknownAction',
        nodeid: 'node-1',
      },
    });
    expect(mutations).toHaveLength(0);

    // 2. 测试直接调用 appendEvent 传入 unknown 类型事件
    store.getState().appendEvent({
      id: 'evt-1',
      type: 'unknown',
      message: 'unknown',
      occurredAt: new Date().toISOString(),
    });
    expect(store.getState().events).toHaveLength(0);
  });

  it('updates device data on changenode event without changing online status if not provided', () => {
    const store = createGatewayStore();
    store.getState().upsertDevice({ id: 'node/1', name: 'Old Name', online: true });

    // 真实 MeshCentral changenode 事件 node 对象通常不带 conn 属性
    const mutations = meshCentralGatewayAdapter.decode({
      action: 'event',
      event: {
        etype: 'node',
        action: 'changenode',
        nodeid: 'node/1',
        node: { _id: 'node/1', name: 'New Name' },
      },
    });

    for (const mutation of mutations) {
      store.getState().applyMutation(mutation);
    }

    expect(store.getState().devices['node/1']?.name).toBe('New Name');
    expect(store.getState().devices['node/1']?.online).toBe(true);
    expect(store.getState().events).toHaveLength(0);

    // 测试直接调用 appendEvent 传入 deviceChanged 类型事件
    store.getState().appendEvent({
      id: 'evt-2',
      type: 'deviceChanged',
      deviceId: 'node/1',
      message: '设备信息变更',
      occurredAt: new Date().toISOString(),
    });
    expect(store.getState().events).toHaveLength(0);
  });

  it('correctly handles deviceOffline (conn: 0), relaylog, and agentlog events', () => {
    const store = createGatewayStore();
    store.getState().upsertDevice({ id: 'node-1', name: 'Server 1', online: true });

    // 1. 设备离线事件 (nodeconnect with conn: 0)
    for (const mutation of meshCentralGatewayAdapter.decode({
      action: 'event',
      event: {
        action: 'nodeconnect',
        nodeid: 'node-1',
        conn: 0,
      },
    })) {
      store.getState().applyMutation(mutation);
    }
    expect(store.getState().devices['node-1']?.online).toBe(false);
    expect(store.getState().events[0]?.type).toBe('deviceOffline');

    // 2. 远控/中继审计事件 (relaylog)
    for (const mutation of meshCentralGatewayAdapter.decode({
      action: 'event',
      event: {
        etype: 'relay',
        action: 'relaylog',
        nodeid: 'node-1',
        msg: 'Ended desktop session "session-1" from 127.0.0.1 to 127.0.0.1, 30 second(s)',
        protocol: 2,
      },
    })) {
      store.getState().applyMutation(mutation);
    }
    expect(store.getState().events[0]?.type).toBe('relayLog');
    expect(store.getState().events[0]?.message).toContain('Ended desktop session');

    // 3. Agent 日志事件 (agentlog)
    for (const mutation of meshCentralGatewayAdapter.decode({
      action: 'event',
      event: {
        etype: 'node',
        action: 'agentlog',
        nodeid: 'node-1',
        msg: 'Upload: "C:/test.txt", Size: 1024',
      },
    })) {
      store.getState().applyMutation(mutation);
    }
    expect(store.getState().events[0]?.type).toBe('agentLog');
  });

  it('correctly transitions offline device to online on nodeconnect event', () => {
    const store = createGatewayStore();
    store.getState().upsertDevice({ id: 'node-offline', name: 'Offline Server', online: false });

    for (const mutation of meshCentralGatewayAdapter.decode({
      action: 'event',
      event: {
        action: 'nodeconnect',
        nodeid: 'node-offline',
        conn: 1,
      },
    })) {
      store.getState().applyMutation(mutation);
    }

    expect(store.getState().devices['node-offline']?.online).toBe(true);
    expect(store.getState().events[0]?.type).toBe('deviceOnline');
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
