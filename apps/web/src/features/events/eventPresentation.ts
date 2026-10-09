import type { HistoricalEventFilter, MeshCentralEvent } from '@meshcentral/control-client';
import type { TFunction } from 'i18next';

const entityTypeKeys: Record<string, string> = {
  node: 'events.entityTypes.node',
  user: 'events.entityTypes.user',
  mesh: 'events.entityTypes.mesh',
  ugrp: 'events.entityTypes.ugrp',
  relay: 'events.entityTypes.relay',
  server: 'events.entityTypes.server',
};

const actionKeys: Record<string, string> = {
  nodeconnect: 'events.actions.nodeconnect',
  connect: 'events.actions.nodeconnect',
  connected: 'events.actions.nodeconnect',
  nodedisconnect: 'events.actions.nodedisconnect',
  disconnect: 'events.actions.nodedisconnect',
  disconnected: 'events.actions.nodedisconnect',
  agentlog: 'events.actions.agentlog',
  changenode: 'events.actions.changenode',
  addnode: 'events.actions.addnode',
  removenode: 'events.actions.removenode',
  deletenode: 'events.actions.removenode',
  runcommands: 'events.actions.runcommands',
  batchupload: 'events.actions.batchupload',
  turnon: 'events.actions.turnon',
  turnoff: 'events.actions.turnoff',
  amtactivate: 'events.actions.amtactivate',
  addedDeviceShare: 'events.actions.addedDeviceShare',
  removedDeviceShare: 'events.actions.removedDeviceShare',
  diagnostic: 'events.actions.diagnostic',
  sessioncompression: 'events.actions.sessioncompression',
  relaylog: 'events.actions.relaylog',
  recording: 'events.actions.recording',
  login: 'events.actions.login',
  logout: 'events.actions.logout',
  authfail: 'events.actions.authfail',
  accountcreate: 'events.actions.accountcreate',
  accountchange: 'events.actions.accountchange',
  accountremove: 'events.actions.accountremove',
  passchange: 'events.actions.passchange',
  loginTokenAdded: 'events.actions.loginTokenAdded',
  createmesh: 'events.actions.createmesh',
  meshchange: 'events.actions.meshchange',
  deletemesh: 'events.actions.deletemesh',
  createusergroup: 'events.actions.createusergroup',
  usergroupchange: 'events.actions.usergroupchange',
  deleteusergroup: 'events.actions.deleteusergroup',
  started: 'events.actions.started',
  stopped: 'events.actions.stopped',
  manual: 'events.actions.manual',
  uicustomevent: 'events.actions.uicustomevent',
  wssessioncount: 'events.actions.wssessioncount',
};

export function eventEntityTypeLabel(event: MeshCentralEvent, t: TFunction) {
  if (!event.entityType) return t('events.entityTypes.unclassified');
  const key = entityTypeKeys[event.entityType];
  return key ? t(key) : event.entityType;
}

export function eventActionLabel(event: MeshCentralEvent, t: TFunction) {
  if (!event.action) return t('events.actions.undefined');
  const key = actionKeys[event.action];
  return key ? t(key) : event.action;
}

export function eventMessage(event: MeshCentralEvent) {
  return event.message || '—';
}

export function isHistoricalEventVisible(event: MeshCentralEvent) {
  return event.type !== 'deviceOffline';
}

export function historicalEventMatches(
  event: MeshCentralEvent,
  filter?: HistoricalEventFilter,
) {
  if (!isHistoricalEventVisible(event)) return false;
  if (!filter) return true;
  if (filter === 'removenode') {
    return event.action === 'removenode' || event.action === 'deletenode';
  }
  return event.action === filter;
}