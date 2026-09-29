import type { Device, DeviceGroup, MeshCentralEvent } from './types';

/**
 * 判断字符串是否看起来像 Node/Mesh/User 的 ID
 * 例如: node//..., mesh//..., user//...
 */
export function isIdString(str?: string): boolean {
  if (!str) return false;
  return /^(node|mesh|user)\/\//i.test(str.trim());
}

/**
 * 获取事件目标节点的显示名称
 * 如果 event.deviceName 为有效节点名称且非 ID，优先返回；
 * 否则尝试从 devices 列表中根据 deviceId 找到对应的节点名称；
 * 若解析出的名称为 ID，则返回 undefined（绝不泄漏 ID）。
 */
export function getEventTargetName(
  event: MeshCentralEvent,
  devices?: Device[] | Record<string, Device>,
): string | undefined {
  if (event.deviceName && !isIdString(event.deviceName)) {
    return event.deviceName;
  }

  if (event.deviceId && devices) {
    const devMap = Array.isArray(devices)
      ? Object.fromEntries(devices.map((d) => [d.id, d]))
      : devices;
    const dev = devMap[event.deviceId];
    if (dev?.name && !isIdString(dev.name)) {
      return dev.name;
    }
  }

  return undefined;
}

/**
 * 格式化事件消息，隐藏/替换其中的节点 ID 或分组 ID，并对所有消息进行中文语义映射
 * 1. 对所有消息（不论原本是否有值）进行类型与动作词汇的中文化映射
 * 2. 替换消息中的 node//... 为节点名称（如无对应节点名则替换为“设备”）
 * 3. 替换消息中的 mesh//... 为设备组名称（如无对应组名则替换为“设备组”）
 * 4. 替换消息中的 user//... 为用户名
 */
export function formatEventMessage(
  event: MeshCentralEvent,
  devices?: Device[] | Record<string, Device>,
  groups?: DeviceGroup[] | Record<string, DeviceGroup>,
): string {
  const rawMsg = (event.message || '').trim();

  // 1. 对所有的 message 进行语义/动作中文化映射
  let message: string;

  const isOnline = event.type === 'deviceOnline' || /^(nodeconnect|connected)$/i.test(rawMsg);
  const isOffline =
    event.type === 'deviceOffline' || /^(nodedisconnect|disconnected)$/i.test(rawMsg);
  const isChanged = event.type === 'deviceChanged' || /^changenode$/i.test(rawMsg);
  const isRemoved = event.type === 'deviceRemoved' || /^(removenode|deletenode)$/i.test(rawMsg);

  if (isOnline) {
    message = '设备已上线';
  } else if (isOffline) {
    message = '设备已离线';
  } else if (isChanged) {
    message = '设备信息变更';
  } else if (isRemoved) {
    message = '设备已移除';
  } else if (!rawMsg || rawMsg === 'unknown') {
    message = `[${event.type}]事件记录`;
  } else {
    // 处理特定的详细操作日志消息，进行短语映射
    message = rawMsg
      .replace(/^Node\s+node\/\/\S+\s+connected/i, '设备已上线')
      .replace(/^Node\s+node\/\/\S+\s+disconnected/i, '设备已离线')
      .replace(/Upload:\s*/gi, '上传文件: ')
      .replace(/Download:\s*/gi, '下载文件: ')
      .replace(/Started file management session/gi, '开始文件管理会话')
      .replace(/Started file management/gi, '开始文件管理')
      .replace(/Started remote desktop session/gi, '开始远程桌面会话')
      .replace(/Started remote desktop/gi, '开始远程桌面')
      .replace(/Started desktop session/gi, '开始远程桌面会话')
      .replace(/Started terminal session/gi, '开始命令行会话')
      .replace(/Ended file management session/gi, '结束文件管理会话')
      .replace(/Ended file management/gi, '结束文件管理')
      .replace(/Ended remote desktop session/gi, '结束远程桌面会话')
      .replace(/Ended remote desktop/gi, '结束远程桌面')
      .replace(/Ended desktop session/gi, '结束远程桌面会话')
      .replace(/Ended terminal session/gi, '结束命令行会话')
      .replace(/Size:\s*/gi, '大小: ')
      .replace(/second\(s\)/gi, '秒')
      .replace(/\bwithout prompt\b/gi, '无提示')
      .replace(/\bwithout\b/gi, '无')
      .replace(/\bfrom\b/gi, '来自')
      .replace(/\bto\b/gi, '至');
  }

  const devMap = devices
    ? Array.isArray(devices)
      ? Object.fromEntries(devices.map((d) => [d.id, d]))
      : devices
    : {};

  const groupMap = groups
    ? Array.isArray(groups)
      ? Object.fromEntries(groups.map((g) => [g.id, g]))
      : groups
    : {};

  // 替换 node//... 为节点名称或“设备”
  message = message.replace(/node\/\/([a-zA-Z0-9_\-./]+)/gi, (fullMatch) => {
    const dev = devMap[fullMatch];
    if (dev?.name && !isIdString(dev.name)) {
      return dev.name;
    }
    if (event.deviceId === fullMatch && event.deviceName && !isIdString(event.deviceName)) {
      return event.deviceName;
    }
    return '设备';
  });

  // 替换 mesh//... 为设备组名称或“设备组”
  message = message.replace(/mesh\/\/([a-zA-Z0-9_\-./]+)/gi, (fullMatch) => {
    const group = groupMap[fullMatch];
    if (group?.name && !isIdString(group.name)) {
      return group.name;
    }
    return '设备组';
  });

  // 替换 user//... 为用户名
  message = message.replace(/user\/\/([a-zA-Z0-9_\-./]+)/gi, '$1');

  return message;
}
