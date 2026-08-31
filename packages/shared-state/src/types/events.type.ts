import type { Device } from './devices.type';

/**
 * 服务端实时事件 Action 类型定义
 */
export enum EventAction {
  /** 节点/设备属性变更事件 */
  ChangeNode = 'changenode',
  /** 设备远程会话变更事件 */
  DeviceSessions = 'devicesessions',
  /** WebSocket 用户在线会话数变动事件 */
  WsSessionCount = 'wssessioncount',
  /** 中继/控制会话日志审计事件 */
  RelayLog = 'relaylog',
  /** 系统信息 Hash 更新事件 */
  SysInfoHash = 'sysinfohash',
  /** 服务器实时性能指标与状态统计事件 */
  ServerTimelineStats = 'servertimelinestats',
  /** 节点上线连接事件 */
  NodeConnect = 'nodeconnect',
  /** 网络接口/网卡变动事件 */
  IfChange = 'ifchange',
  /** Agent 操作日志审计事件 */
  AgentLog = 'agentlog',
}

/**
 * 事件类别标识 (etype)
 */
export type EventCategory = 'node' | 'relay' | string;

/**
 * 1. 节点/设备属性变更事件 Payload (changenode)
 * 当设备的名称、系统、IP、用户或配置发生变化时触发
 */
export interface ChangeNodeEventPayload {
  etype?: 'node' | string;
  action: EventAction.ChangeNode | 'changenode';
  /** 目标设备节点 ID */
  nodeid: string;
  /** 所属域 */
  domain?: string;
  /** 设备的最新详细数据 */
  node: Device;
  /** 是否记录系统日志标志 (1 表示不记录) */
  nolog?: number;
}

/**
 * 2. 设备会话变更事件 Payload (devicesessions)
 * 当设备上的活动控制会话状态变动时触发
 */
export interface DeviceSessionsEventPayload {
  etype?: 'node' | string;
  action: EventAction.DeviceSessions | 'devicesessions';
  /** 目标设备节点 ID */
  nodeid: string;
  /** 所属域 */
  domain?: string;
  /** 是否记录系统日志标志 */
  nolog?: number;
}

/**
 * 3. WebSocket 会话计数事件 Payload (wssessioncount)
 * 记录用户当前建立的 WebSocket 活跃连接总数
 */
export interface WsSessionCountEventPayload {
  action: EventAction.WsSessionCount | 'wssessioncount';
  /** 用户 ID */
  userid: string;
  /** 用户名 */
  username: string;
  /** 当前用户活跃的 WebSocket 会话连接数 */
  count: number;
  /** 所属域 */
  domain?: string;
  /** 是否记录系统日志标志 */
  nolog?: number;
}

/**
 * 4. 控制与中继日志审计事件 Payload (relaylog)
 * 记录远程桌面、文件管理、终端命令行等中继控制会话结束时的统计信息
 */
export interface RelayLogEventPayload {
  etype?: 'relay' | string;
  action: EventAction.RelayLog | 'relaylog';
  /** 所属域 */
  domain?: string;
  /** 执行操作的用户 ID */
  userid: string;
  /** 执行操作的用户名 */
  username: string;
  /** 消息 ID */
  msgid?: number;
  /** 消息格式化参数列表 */
  msgArgs?: (string | number)[];
  /** 会话描述信息 */
  msg: string;
  /** 控制协议类型编号 (例如 5: 文件管理, 2: 远程桌面) */
  protocol: number;
  /** 目标设备节点 ID */
  nodeid: string;
  /** 会话接收字节数 (上传流量) */
  bytesin: number;
  /** 会话发送字节数 (下载流量) */
  bytesout: number;
  /** 事件记录时间戳 ISO 字符串 */
  time: string;
}

/**
 * 5. 系统信息 Hash 更新事件 Payload (sysinfohash)
 * 推送设备最新系统配置的 SHA-256 Hash，用于增量校验
 */
export interface SysInfoHashEventPayload {
  etype?: 'node' | string;
  action: EventAction.SysInfoHash | 'sysinfohash';
  /** 目标设备节点 ID */
  nodeid: string;
  /** 所属域 */
  domain?: string;
  /** 系统信息的 SHA-256 哈希值 */
  hash: string;
  /** 是否记录系统日志标志 */
  nolog?: number;
}

/**
 * 服务器性能统计数据指标
 */
export interface ServerTimelineStatsData {
  /** 统计时间 ISO 字符串 */
  time: string;
  /** 过期时间 ISO 字符串 */
  expire?: string;
  /** 内存使用情况 (字节) */
  mem: {
    rss: number;
    heapTotal?: number;
    heapUsed: number;
    external?: number;
    arrayBuffers?: number;
  };
  /** 连接数统计 */
  conn: {
    /** 智能 Agent 连接数 */
    ca: number;
    /** 用户连接数 */
    cu?: number;
    /** 用户 session 数 */
    us?: number;
    /** 中继 session 数 */
    rs?: number;
    am?: number;
    amc?: number;
    [key: string]: number | undefined;
  };
  /** 流量与请求统计 */
  traffic: {
    httpRequestCount?: number;
    httpWebSocketCount?: number;
    httpIn?: number;
    httpOut?: number;
    relayCount?: Record<string, number>;
    relayIn?: Record<string, number>;
    relayOut?: Record<string, number>;
    localRelayCount?: Record<string, number>;
    localRelayIn?: Record<string, number>;
    localRelayOut?: Record<string, number>;
    AgentCtrlIn?: number;
    AgentCtrlOut?: number;
    LMSIn?: number;
    LMSOut?: number;
    CIRAIn?: number;
    CIRAOut?: number;
    time?: number;
    delta?: number;
    [key: string]: unknown;
  };
  /** CPU 1分/5分/15分平均负载数组 */
  cpu: number[];
  /** 统计记录数据库 ID */
  _id?: string;
}

/**
 * 6. 服务器性能与统计推送到控制台的事件 Payload (servertimelinestats)
 */
export interface ServerTimelineStatsEventPayload {
  action: EventAction.ServerTimelineStats | 'servertimelinestats';
  /** 服务器性能监控指标数据 */
  data: ServerTimelineStatsData;
  /** 推送时间 ISO 字符串 */
  time?: string;
}

/**
 * 7. 节点上线事件 Payload (nodeconnect)
 * Agent 成功连接服务端时触发
 */
export interface NodeConnectEventPayload {
  etype?: 'node' | string;
  action: EventAction.NodeConnect | 'nodeconnect';
  /** 设备组 ID */
  meshid: string;
  /** 设备节点 ID */
  nodeid: string;
  /** 所属域 */
  domain?: string;
  /** 连接状态 (1 表示在线连通) */
  conn: number;
  /** 电源状态 */
  pwr?: number;
  /** 连接建立时间戳 */
  ct?: number;
  /** 是否记录日志标志 */
  nolog?: number;
  /** 无 Peer 标志 */
  nopeers?: number;
  /** 随机序列/会话标识 ID */
  id?: number;
  /** 消息提示 */
  msg?: string;
}

/**
 * 9. 网络接口/网卡变动事件 Payload (ifchange)
 * 当设备的 IP 地址或网卡状态变化时触发
 */
export interface IfChangeEventPayload {
  etype?: 'node' | string;
  action: EventAction.IfChange | 'ifchange';
  /** 目标设备节点 ID */
  nodeid: string;
  /** 所属域 */
  domain?: string;
  /** 是否记录日志标志 */
  nolog?: number;
}

/**
 * 10. Agent 操作日志审计事件 Payload (agentlog)
 * 当设备 Agent 执行文件上传/下载、命令执行等操作时触发
 */
export interface AgentLogEventPayload {
  etype?: 'node' | string;
  action: EventAction.AgentLog | 'agentlog';
  /** 目标设备节点 ID */
  nodeid: string;
  /** 所属域 */
  domain?: string;
  /** 操作描述日志信息 */
  msg: string;
  /** 消息格式化 ID */
  msgid?: number;
  /** 消息格式化参数 */
  msgArgs?: (string | number)[];
  /** 远程客户端 IP 地址 */
  remoteaddr?: string;
  /** 操作用户 ID */
  userid?: string;
  /** 操作用户名 */
  username?: string;
  /** 会话 ID */
  sessionid?: string;
  /** ISO 时间戳 */
  time?: string;
  /** 是否记录日志标志 */
  nolog?: number;
}

/**
 * 所有 MeshCentral 实时事件 Payload 联合类型
 */
export type MeshCentralEventPayload =
  | ChangeNodeEventPayload
  | DeviceSessionsEventPayload
  | WsSessionCountEventPayload
  | RelayLogEventPayload
  | SysInfoHashEventPayload
  | ServerTimelineStatsEventPayload
  | NodeConnectEventPayload
  | IfChangeEventPayload
  | AgentLogEventPayload;

/**
 * 服务端发送给客户端的实时事件 WebSocket 顶层消息封装
 */
export interface MeshCentralEventMessage<T = MeshCentralEventPayload> {
  /** 消息 Action 固定的标头，为 "event" */
  action: 'event';
  /** 事件的具体 Payload 内容 */
  event: T;
}

/** 节点属性变更完整事件消息 */
export type ChangeNodeEventMessage = MeshCentralEventMessage<ChangeNodeEventPayload>;
/** 设备会话更新完整事件消息 */
export type DeviceSessionsEventMessage = MeshCentralEventMessage<DeviceSessionsEventPayload>;
/** WebSocket 会话计数完整事件消息 */
export type WsSessionCountEventMessage = MeshCentralEventMessage<WsSessionCountEventPayload>;
/** 中继日志审计完整事件消息 */
export type RelayLogEventMessage = MeshCentralEventMessage<RelayLogEventPayload>;
/** 系统信息 Hash 更新完整事件消息 */
export type SysInfoHashEventMessage = MeshCentralEventMessage<SysInfoHashEventPayload>;
/** 服务器性能监控指标完整事件消息 */
export type ServerTimelineStatsEventMessage =
  MeshCentralEventMessage<ServerTimelineStatsEventPayload>;
/** 节点上线完整事件消息 */
export type NodeConnectEventMessage = MeshCentralEventMessage<NodeConnectEventPayload>;
/** 网络接口变动完整事件消息 */
export type IfChangeEventMessage = MeshCentralEventMessage<IfChangeEventPayload>;

/** 任意 MeshCentral 实时事件完整 WebSocket 消息 */
export type AnyMeshCentralEventMessage = MeshCentralEventMessage<MeshCentralEventPayload>;
