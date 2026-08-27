import {
  CloseOutlined,
  DisconnectOutlined,
  ExperimentOutlined,
  StopOutlined,
} from '@ant-design/icons';
import {
  RELAY_PROTOCOLS,
  RelayClient,
  type RelayCloseEventLike,
  type RelayConnectionState,
  type RelayInboundData,
  type RelaySession,
} from '@meshcentral/relay';
import type { Device, GatewayClient } from '@meshcentral/shared-state';
import { Alert, Button, Modal, Select, Space, Tag } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';

interface RelayValidationModalProps {
  open: boolean;
  device: Device | null;
  gatewayClient?: GatewayClient;
  gatewayUrl?: string;
  onClose: () => void;
}

interface ValidationLog {
  id: number;
  elapsedMs: number;
  level: 'info' | 'success' | 'warning' | 'error';
  message: string;
}

const stateLabels: Record<RelayConnectionState, string> = {
  idle: '空闲',
  authorizing: '获取认证',
  notifying: '通知 Agent',
  connecting: '连接中继',
  handshaking: '等待握手',
  ready: '已就绪',
  closing: '关闭中',
  closed: '已关闭',
  error: '错误',
};

const protocolOptions = [
  { value: RELAY_PROTOCOLS.files, label: '文件管理（p=5）' },
  { value: RELAY_PROTOCOLS.terminal, label: '远程终端（p=1）' },
  { value: RELAY_PROTOCOLS.desktop, label: '远程桌面（p=2）' },
];

function relayBaseUrl(gatewayUrl: string): string {
  const configured = import.meta.env.VITE_RELAY_BASE_URL?.trim();
  if (configured) return configured;

  const url = new URL(gatewayUrl);
  url.search = '';
  url.hash = '';
  url.pathname = url.pathname.replace(/\/(control|control\.ashx)\/?$/i, '') || '/';
  return url.toString();
}

function sanitizeText(value: string): string {
  return value
    .replace(/([?&](?:auth|rauth)=)[^&\s]+/gi, '$1[已脱敏]')
    .replace(/("?(?:cookie|rcookie|auth|rauth)"?\s*[:=]\s*")[^"]+/gi, '$1[已脱敏]')
    .replace(/wss?:\/\/[^\s"']+/gi, '[中继 URL 已脱敏]');
}

function summarizeMessage(data: RelayInboundData): string {
  if (typeof data === 'string') {
    const trimmed = data.trim();
    if (trimmed === 'c') return '收到文本握手消息："c"';
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      const keys =
        typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
          ? Object.keys(parsed).slice(0, 8).join('、')
          : '非对象';
      return `收到 JSON 文本（${data.length} 字符，字段：${keys || '无'}）`;
    } catch {
      const preview = sanitizeText(trimmed).slice(0, 100);
      return `收到文本（${data.length} 字符）：${preview}${trimmed.length > 100 ? '…' : ''}`;
    }
  }
  if (data instanceof ArrayBuffer) return `收到 ArrayBuffer（${data.byteLength} 字节）`;
  if (ArrayBuffer.isView(data)) return `收到二进制视图（${data.byteLength} 字节）`;
  return `收到 Blob（${data.size} 字节，类型：${data.type || '未知'}）`;
}

function summarizeClose(event: RelayCloseEventLike): string {
  const code = event.code ?? '未知';
  const reason = event.reason ? sanitizeText(event.reason) : '无原因';
  return `中继已关闭：code=${code}，clean=${String(event.wasClean ?? '未知')}，reason=${reason}`;
}

export function RelayValidationModal({
  open,
  device,
  gatewayClient,
  gatewayUrl,
  onClose,
}: RelayValidationModalProps) {
  const [protocol, setProtocol] = useState<number>(RELAY_PROTOCOLS.files);
  const [state, setState] = useState<RelayConnectionState>('idle');
  const [logs, setLogs] = useState<ValidationLog[]>([]);
  const [busy, setBusy] = useState(false);
  const sessionRef = useRef<RelaySession | undefined>(undefined);
  const abortRef = useRef<AbortController | undefined>(undefined);
  const startedAtRef = useRef(0);
  const logIdRef = useRef(0);

  const baseUrl = useMemo(() => {
    if (!gatewayUrl) return undefined;
    try {
      return relayBaseUrl(gatewayUrl);
    } catch {
      return undefined;
    }
  }, [gatewayUrl]);

  const addLog = (level: ValidationLog['level'], message: string) => {
    const elapsedMs = startedAtRef.current ? performance.now() - startedAtRef.current : 0;
    setLogs((current) => [
      ...current,
      { id: ++logIdRef.current, elapsedMs: Math.round(elapsedMs), level, message },
    ]);
  };

  const reset = () => {
    abortRef.current?.abort();
    sessionRef.current?.cancel('Validation dialog reset.');
    abortRef.current = undefined;
    sessionRef.current = undefined;
    startedAtRef.current = 0;
    setBusy(false);
    setState('idle');
    setLogs([]);
  };

  useEffect(() => {
    if (!open) reset();
    return () => {
      abortRef.current?.abort();
      sessionRef.current?.cancel('Validation dialog closed.');
    };
  }, [open]);

  const connect = async () => {
    if (!device || !gatewayClient || !baseUrl || busy) return;
    abortRef.current?.abort();
    sessionRef.current?.cancel('Starting a new validation.');
    const controller = new AbortController();
    abortRef.current = controller;
    sessionRef.current = undefined;
    startedAtRef.current = performance.now();
    logIdRef.current = 0;
    setLogs([]);
    setState('idle');
    setBusy(true);
    addLog('info', `开始验证 ${device.name} 的 p=${protocol} 中继连接`);

    const relayClient = new RelayClient({
      baseUrl,
      control: gatewayClient,
    });

    try {
      const session = await relayClient.createSession({
        deviceId: device.id,
        protocol,
        signal: controller.signal,
        onStateChange: ({ previous, current, error }) => {
          setState(current);
          addLog(
            current === 'ready' ? 'success' : current === 'error' ? 'error' : 'info',
            `${stateLabels[previous]} → ${stateLabels[current]}${error ? `：${sanitizeText(error.message)}` : ''}`,
          );
        },
        onRawMessage: (data) => addLog('info', summarizeMessage(data)),
        onError: (error) => addLog('error', `${error.name}：${sanitizeText(error.message)}`),
        onClose: (event) => addLog(event.wasClean ? 'success' : 'warning', summarizeClose(event)),
      });
      if (controller.signal.aborted) {
        session.cancel('Validation was cancelled.');
        return;
      }
      sessionRef.current = session;
      addLog('success', `中继已进入 ready，总耗时 ${Math.round(performance.now() - startedAtRef.current)} ms`);
    } catch (error) {
      const detail = error instanceof Error ? `${error.name}：${error.message}` : '未知错误';
      addLog('error', `连接失败：${sanitizeText(detail)}`);
    } finally {
      setBusy(false);
    }
  };

  const closeSession = () => {
    if (!sessionRef.current) return;
    addLog('info', '请求正常关闭中继会话');
    sessionRef.current.close(1000, 'Relay validation completed.');
  };

  const cancelSession = () => {
    addLog('warning', '请求取消中继验证');
    if (sessionRef.current) sessionRef.current.cancel('Relay validation cancelled.');
    else abortRef.current?.abort();
  };

  const canConnect = Boolean(device?.online && gatewayClient && baseUrl) && !busy;
  const active = busy || ['connecting', 'handshaking', 'ready', 'closing'].includes(state);

  return (
    <Modal
      open={open}
      title={<Space><ExperimentOutlined />中继连接验证</Space>}
      width={760}
      onCancel={onClose}
      footer={null}
      destroyOnHidden
    >
      <div className="relay-validation">
        <Alert
          type="warning"
          showIcon
          message="仅用于开发验证"
          description="该入口只验证认证、Agent 通知、WebSocket 握手和生命周期，不发送文件、终端或桌面业务指令。日志不会显示 Cookie 或完整中继 URL。"
        />
        <div className="relay-validation-controls">
          <div>
            <span>目标设备</span>
            <strong>{device?.name ?? '未选择'}</strong>
            <small>{device?.online ? '在线' : '离线'}</small>
          </div>
          <label>
            <span>协议</span>
            <Select
              value={protocol}
              options={protocolOptions}
              disabled={active}
              onChange={setProtocol}
            />
          </label>
          <div>
            <span>当前状态</span>
            <Tag color={state === 'ready' ? 'success' : state === 'error' ? 'error' : 'processing'}>
              {stateLabels[state]}
            </Tag>
          </div>
        </div>
        {!baseUrl && <Alert type="error" showIcon message="无法从网关地址推导中继地址，请配置 VITE_RELAY_BASE_URL。" />}
        <Space wrap>
          <Button type="primary" icon={<ExperimentOutlined />} disabled={!canConnect} loading={busy} onClick={() => void connect()}>
            连接
          </Button>
          <Button icon={<CloseOutlined />} disabled={!sessionRef.current || state !== 'ready'} onClick={closeSession}>
            正常关闭
          </Button>
          <Button danger icon={<StopOutlined />} disabled={!active} onClick={cancelSession}>
            取消
          </Button>
          <Button icon={<DisconnectOutlined />} disabled={active || logs.length === 0} onClick={reset}>
            清空记录
          </Button>
        </Space>
        <div className="relay-validation-log" aria-live="polite">
          {logs.length === 0 ? (
            <span className="relay-validation-empty">尚未开始验证</span>
          ) : (
            logs.map((log) => (
              <div key={log.id} className={`relay-log-${log.level}`}>
                <time>+{log.elapsedMs} ms</time>
                <span>{log.message}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </Modal>
  );
}