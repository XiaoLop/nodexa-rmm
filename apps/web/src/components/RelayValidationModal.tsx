import {
  CloseOutlined,
  DisconnectOutlined,
  ExperimentOutlined,
  FolderOpenOutlined,
  StopOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import {
  FilesSession,
  RELAY_PROTOCOLS,
  RelayClient,
  browserFileSource,
  type DirectoryListing,
  type FileUploadProgress,
  type RelayCloseEventLike,
  type RelayConnectionState,
  type RelayInboundData,
  type RelaySession,
} from '@meshcentral/relay';
import type { GatewayClient } from '@meshcentral/control-client';
import type { Device } from '@meshcentral/shared-state';
import { Alert, Button, Input, Modal, Progress, Select, Space, Table, Tag } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import { GATEWAY_RELAY_URL } from '../config/gateway';

interface RelayValidationModalProps {
  open: boolean;
  device: Device | null;
  gatewayClient?: GatewayClient;
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
  onClose,
}: RelayValidationModalProps) {
  const [protocol, setProtocol] = useState<number>(RELAY_PROTOCOLS.files);
  const [state, setState] = useState<RelayConnectionState>('idle');
  const [logs, setLogs] = useState<ValidationLog[]>([]);
  const [busy, setBusy] = useState(false);
  const [fileBusy, setFileBusy] = useState(false);
  const [remotePath, setRemotePath] = useState('');
  const [listing, setListing] = useState<DirectoryListing | undefined>();
  const [uploadProgress, setUploadProgress] = useState<FileUploadProgress | undefined>();
  const sessionRef = useRef<RelaySession | undefined>(undefined);
  const filesRef = useRef<FilesSession | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | undefined>(undefined);
  const startedAtRef = useRef(0);
  const logIdRef = useRef(0);
  const baseUrl = GATEWAY_RELAY_URL;

  const addLog = (level: ValidationLog['level'], message: string) => {
    const elapsedMs = startedAtRef.current ? performance.now() - startedAtRef.current : 0;
    setLogs((current) => [
      ...current,
      { id: ++logIdRef.current, elapsedMs: Math.round(elapsedMs), level, message },
    ]);
  };

  const reset = () => {
    abortRef.current?.abort();
    filesRef.current?.dispose();
    sessionRef.current?.cancel('Validation dialog reset.');
    abortRef.current = undefined;
    filesRef.current = undefined;
    sessionRef.current = undefined;
    startedAtRef.current = 0;
    setBusy(false);
    setFileBusy(false);
    setState('idle');
    setLogs([]);
    setListing(undefined);
    setUploadProgress(undefined);
  };

  useEffect(() => {
    if (!open) reset();
    return () => {
      abortRef.current?.abort();
      filesRef.current?.dispose();
      sessionRef.current?.cancel('Validation dialog closed.');
    };
  }, [open]);

  const connect = async () => {
    if (!device || !gatewayClient || !baseUrl || busy) return;
    abortRef.current?.abort();
    filesRef.current?.dispose();
    sessionRef.current?.cancel('Starting a new validation.');
    const controller = new AbortController();
    abortRef.current = controller;
    filesRef.current = undefined;
    sessionRef.current = undefined;
    startedAtRef.current = performance.now();
    logIdRef.current = 0;
    setLogs([]);
    setState('idle');
    setBusy(true);
    setFileBusy(false);
    setListing(undefined);
    setUploadProgress(undefined);
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
      if (protocol === RELAY_PROTOCOLS.files) {
        filesRef.current = new FilesSession(session, {
          onUnhandledMessage: (message) =>
            addLog(
              'warning',
              `收到未关联的文件协议消息：${sanitizeText(JSON.stringify(message)).slice(0, 160)}`,
            ),
        });
      }
      addLog(
        'success',
        `中继已进入 ready，总耗时 ${Math.round(performance.now() - startedAtRef.current)} ms`,
      );
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
    filesRef.current?.dispose();
    filesRef.current = undefined;
    sessionRef.current.close(1000, 'Relay validation completed.');
  };

  const cancelSession = () => {
    addLog('warning', '请求取消中继验证');
    filesRef.current?.cancelActive('Relay validation cancelled.');
    if (sessionRef.current) sessionRef.current.cancel('Relay validation cancelled.');
    else abortRef.current?.abort();
  };

  const listDirectory = async () => {
    const files = filesRef.current;
    if (!files || fileBusy) return;
    setFileBusy(true);
    addLog('info', `读取远程目录：${remotePath || '[根目录]'}`);
    try {
      const result = await files.listDirectory(remotePath, { timeoutMs: 20_000 });
      setListing(result);
      setRemotePath(result.path);
      addLog('success', `目录读取完成，共 ${result.entries.length} 项`);
    } catch (error) {
      addLog(
        'error',
        `目录读取失败：${sanitizeText(error instanceof Error ? error.message : '未知错误')}`,
      );
    } finally {
      setFileBusy(false);
    }
  };

  const uploadFile = async (file: File) => {
    const files = filesRef.current;
    if (!files || fileBusy) return;
    setFileBusy(true);
    setUploadProgress(undefined);
    addLog('info', `开始上传 ${file.name}（${file.size} 字节）`);
    try {
      await files.uploadFile(remotePath, browserFileSource(file), {
        timeoutMs: 60_000,
        onProgress: setUploadProgress,
      });
      addLog('success', `文件上传完成：${file.name}`);
    } catch (error) {
      addLog(
        'error',
        `文件上传失败：${sanitizeText(error instanceof Error ? error.message : '未知错误')}`,
      );
    } finally {
      setFileBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const canConnect = Boolean(device?.online && gatewayClient && baseUrl) && !busy;
  const active = busy || ['connecting', 'handshaking', 'ready', 'closing'].includes(state);

  return (
    <Modal
      open={open}
      title={
        <Space>
          <ExperimentOutlined />
          中继连接验证
        </Space>
      }
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
          description="文件协议可读取目录并向当前设备上传单个测试文件；终端和桌面协议仍只验证连接。请勿上传敏感或大型文件。日志不会显示 Cookie 或完整中继 URL。"
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
        {!baseUrl && (
          <Alert
            type="error"
            showIcon
            message="中继地址不可用，请配置 VITE_GATEWAY_WS_URL。"
          />
        )}
        <Space wrap>
          <Button
            type="primary"
            icon={<ExperimentOutlined />}
            disabled={!canConnect}
            loading={busy}
            onClick={() => void connect()}
          >
            连接
          </Button>
          <Button
            icon={<CloseOutlined />}
            disabled={!sessionRef.current || state !== 'ready'}
            onClick={closeSession}
          >
            正常关闭
          </Button>
          <Button danger icon={<StopOutlined />} disabled={!active} onClick={cancelSession}>
            取消
          </Button>
          <Button
            icon={<DisconnectOutlined />}
            disabled={active || logs.length === 0}
            onClick={reset}
          >
            清空记录
          </Button>
        </Space>
        {protocol === RELAY_PROTOCOLS.files && state === 'ready' && (
          <div className="relay-files-validation">
            <div className="relay-files-toolbar">
              <Input
                value={remotePath}
                disabled={fileBusy}
                placeholder="根目录留空，例如 C:\\Temp 或 /tmp"
                onChange={(event) => setRemotePath(event.target.value)}
                onPressEnter={() => void listDirectory()}
              />
              <Button
                icon={<FolderOpenOutlined />}
                loading={fileBusy}
                onClick={() => void listDirectory()}
              >
                读取目录
              </Button>
              <input
                ref={fileInputRef}
                hidden
                type="file"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void uploadFile(file);
                }}
              />
              <Button
                icon={<UploadOutlined />}
                disabled={fileBusy}
                onClick={() => fileInputRef.current?.click()}
              >
                上传文件
              </Button>
              <Button danger disabled={!fileBusy} onClick={() => filesRef.current?.cancelActive()}>
                取消操作
              </Button>
            </div>
            {uploadProgress && (
              <Progress
                percent={Number(uploadProgress.percentage.toFixed(1))}
                status={uploadProgress.state === 'failed' ? 'exception' : undefined}
                format={(percent) =>
                  `${percent}% · ${uploadProgress.acknowledgedBytes}/${uploadProgress.totalBytes} B`
                }
              />
            )}
            <Table
              size="small"
              pagination={false}
              rowKey="path"
              dataSource={listing?.entries ?? []}
              locale={{ emptyText: listing ? '目录为空' : '尚未读取目录' }}
              columns={[
                { title: '名称', dataIndex: 'name', ellipsis: true },
                { title: '类型', dataIndex: 'kind', width: 90 },
                {
                  title: '大小',
                  dataIndex: 'size',
                  width: 110,
                  render: (value?: number) => value ?? '—',
                },
                {
                  title: '修改时间',
                  dataIndex: 'modifiedAt',
                  width: 180,
                  render: (value?: Date) => value?.toLocaleString() ?? '—',
                },
              ]}
            />
          </div>
        )}
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
