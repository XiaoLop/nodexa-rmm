import {
  ClearOutlined,
  CloseOutlined,
  CopyOutlined,
  DisconnectOutlined,
  ExpandOutlined,
  LinkOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import type { GatewayClient } from '@meshcentral/control-client';
import {
  RELAY_PROTOCOLS,
  RelayAgentRouteError,
  RelayCancelledError,
  RelayClient,
  TerminalSession,
  createTerminalOptionsMessage,
  type RelaySession,
  type TerminalSize,
} from '@meshcentral/relay';
import type { Device } from '@meshcentral/shared-state';
import { Alert, Button, Input, Modal, Space, Tag, Tooltip, message } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { GATEWAY_RELAY_URL } from '../../../config/gateway';
import { XtermTerminal, type XtermTerminalHandle } from './XtermTerminal';

type TerminalConnectionState =
  | 'idle'
  | 'authorizing'
  | 'notifying'
  | 'connecting'
  | 'handshaking'
  | 'ready'
  | 'closed'
  | 'error';

const CONNECTING_STATES = new Set<TerminalConnectionState>([
  'authorizing',
  'notifying',
  'connecting',
  'handshaking',
]);

const STATUS_LABELS: Record<TerminalConnectionState, string> = {
  idle: '未连接',
  authorizing: '正在申请中继授权',
  notifying: '正在通知设备 Agent',
  connecting: '正在连接中继',
  handshaking: '正在等待终端配对',
  ready: '已连接',
  closed: '会话已结束',
  error: '连接失败',
};

interface TerminalPanelProps {
  device: Device;
  gatewayClient?: GatewayClient;
  gatewayConnected: boolean;
  terminalAllowed?: boolean;
}

function requiresPasteConfirmation(text: string): boolean {
  return text.length > 500 || /[\r\n]/.test(text) || Array.from(text).some(isUnsafeControlCharacter);
}

function pastePreview(text: string): string {
  return Array.from(text, (character) => (isUnsafeControlCharacter(character) ? '·' : character))
    .join('')
    .slice(0, 320);
}

function isUnsafeControlCharacter(character: string): boolean {
  const code = character.charCodeAt(0);
  return (code >= 0 && code <= 8) || code === 11 || code === 12 || (code >= 14 && code <= 31) || code === 127;
}

function connectionErrorMessage(error: unknown): string {
  if (error instanceof RelayAgentRouteError) {
    return '设备 Agent 当前无法建立终端通道，请稍后重试。';
  }
  if (error instanceof RelayCancelledError) return '终端连接已取消。';
  return error instanceof Error ? error.message : '终端中继连接失败。';
}

export function TerminalPanel({ device, gatewayClient, gatewayConnected, terminalAllowed }: TerminalPanelProps) {
  const [messageApi, messageContextHolder] = message.useMessage();
  const [status, setStatus] = useState<TerminalConnectionState>('idle');
  const [error, setError] = useState<string>();
  const [latency, setLatency] = useState<number>();
  const [recorded, setRecorded] = useState(false);
  const [size, setSize] = useState<TerminalSize>({ cols: 80, rows: 24 });
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingPaste, setPendingPaste] = useState<string>();
  const [startedAt, setStartedAt] = useState<number>();
  const [duration, setDuration] = useState(0);
  const shellRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XtermTerminalHandle>(null);
  const relayRef = useRef<RelaySession | undefined>(undefined);
  const sessionRef = useRef<TerminalSession | undefined>(undefined);
  const abortRef = useRef<AbortController | undefined>(undefined);

  const disconnect = (reason = 'Terminal session closed.') => {
    abortRef.current?.abort();
    abortRef.current = undefined;
    sessionRef.current?.close(1000, reason);
    sessionRef.current = undefined;
    relayRef.current = undefined;
    setStatus((current) => (current === 'idle' ? current : 'closed'));
    setLatency(undefined);
  };

  const cancelConnection = () => {
    abortRef.current?.abort();
    abortRef.current = undefined;
    setStatus('closed');
    setError(undefined);
  };

  useEffect(() => () => disconnect('Terminal panel unmounted.'), []);
  useEffect(() => {
    disconnect('Terminal device changed.');
    setStatus('idle');
    setError(undefined);
  }, [device.id, gatewayClient]);
  useEffect(() => {
    if (gatewayConnected || (!sessionRef.current && !abortRef.current)) return;
    disconnect('Gateway connection was lost.');
    setError('网关连接已断开，终端会话已结束。');
  }, [gatewayConnected]);
  useEffect(() => {
    if (!startedAt || status !== 'ready') return;
    const update = () => setDuration(Math.floor((Date.now() - startedAt) / 1000));
    update();
    const timer = setInterval(update, 1_000);
    return () => clearInterval(timer);
  }, [startedAt, status]);

  const connect = async () => {
    if (CONNECTING_STATES.has(status) || status === 'ready') return;
    if (!device.online || !gatewayConnected || !gatewayClient || terminalAllowed === false) {
      setError(
        terminalAllowed === false
          ? '当前账户没有该设备的终端权限。'
          : !device.online
            ? '设备当前离线，无法建立终端中继。'
            : '网关控制通道不可用。',
      );
      setStatus('error');
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    const initialSize = xtermRef.current?.getSize() ?? size;
    let sessionRecorded = false;
    setStatus('connecting');
    setError(undefined);
    setRecorded(false);
    try {
      const relayClient = new RelayClient({ baseUrl: GATEWAY_RELAY_URL, control: gatewayClient });
      const relay = await relayClient.createSession({
        deviceId: device.id,
        protocol: RELAY_PROTOCOLS.terminal,
        signal: controller.signal,
        onStateChange: ({ current }) => {
          if (
            current === 'authorizing' ||
            current === 'notifying' ||
            current === 'connecting' ||
            current === 'handshaking'
          ) {
            setStatus(current);
          }
        },
        onHandshakeMessage: (handshake) => {
          sessionRecorded = handshake === 'cr';
        },
        createStartupMessages: () => [createTerminalOptionsMessage(1, initialSize), '1'],
      });
      if (controller.signal.aborted) {
        relay.cancel('Terminal connection was cancelled.');
        return;
      }
      relayRef.current = relay;
      const terminalSession = new TerminalSession(relay, {
        initialSize,
        recorded: sessionRecorded,
      });
      sessionRef.current = terminalSession;
      terminalSession.onLatencyChange(setLatency);
      terminalSession.onStateChange((next) => setStatus(next === 'ready' ? 'ready' : next));
      setRecorded(sessionRecorded);
      setStartedAt(Date.now());
      setDuration(0);
      setStatus('ready');
      xtermRef.current?.writeLocal('\r\n\x1b[32m已建立新的终端会话。\x1b[0m\r\n');
      xtermRef.current?.focus();
    } catch (connectionError) {
      if (controller.signal.aborted) {
        setStatus('closed');
        return;
      }
      setError(connectionErrorMessage(connectionError));
      setStatus('error');
    }
  };

  const handleSizeChange = (nextSize: TerminalSize) => {
    setSize(nextSize);
    if (sessionRef.current?.state === 'ready') {
      try {
        sessionRef.current.resize(nextSize);
      } catch {
        return;
      }
    }
  };

  const requestPaste = async () => {
    if (status !== 'ready') return;
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return;
      if (requiresPasteConfirmation(text)) setPendingPaste(text);
      else sessionRef.current?.write(text);
    } catch {
      void messageApi.error('无法读取剪贴板，请确认页面使用 HTTPS 且已授予权限。');
    }
  };

  const copySelection = async () => {
    const selection = xtermRef.current?.getSelection() ?? '';
    if (!selection) {
      void messageApi.info('请先在终端中选择文本。');
      return;
    }
    try {
      await navigator.clipboard.writeText(selection);
      void messageApi.success('已复制终端选区。');
    } catch {
      void messageApi.error('无法写入剪贴板。');
    }
  };

  const toggleFullscreen = async () => {
    if (!shellRef.current) return;
    if (document.fullscreenElement) await document.exitFullscreen();
    else await shellRef.current.requestFullscreen();
  };

  const durationText = `${String(Math.floor(duration / 60)).padStart(2, '0')}:${String(duration % 60).padStart(2, '0')}`;
  const unavailable = !device.online || !gatewayConnected || terminalAllowed === false;
  const connecting = CONNECTING_STATES.has(status);

  return (
    <section ref={shellRef} className="console-card terminal-panel">
      {messageContextHolder}
      <div className="terminal-toolbar">
        <Space size={4}>
          {connecting ? (
            <Button icon={<CloseOutlined />} onClick={cancelConnection}>
              取消连接
            </Button>
          ) : status !== 'ready' ? (
            <Button
              type="primary"
              icon={<LinkOutlined />}
              disabled={unavailable}
              onClick={() => void connect()}
            >
              连接终端
            </Button>
          ) : (
            <Button icon={<DisconnectOutlined />} danger onClick={() => disconnect('User disconnected terminal session.')}>
              断开
            </Button>
          )}
          <Tooltip title="搜索缓冲区"><Button aria-label="搜索缓冲区" icon={<SearchOutlined />} onClick={() => setSearchOpen((value) => !value)} /></Tooltip>
          <Tooltip title="复制选区"><Button aria-label="复制选区" icon={<CopyOutlined />} onClick={() => void copySelection()} /></Tooltip>
          <Tooltip title="粘贴"><Button aria-label="粘贴" onClick={() => void requestPaste()}>粘贴</Button></Tooltip>
          <Tooltip title="清除本地显示"><Button aria-label="清除本地显示" icon={<ClearOutlined />} onClick={() => xtermRef.current?.clear()} /></Tooltip>
          <Tooltip title="全屏"><Button aria-label="全屏" icon={<ExpandOutlined />} onClick={() => void toggleFullscreen()} /></Tooltip>
        </Space>
        {searchOpen ? (
          <Input
            autoFocus
            allowClear
            size="small"
            prefix={<SearchOutlined />}
            placeholder="搜索终端输出"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onPressEnter={() => xtermRef.current?.searchNext(searchQuery)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setSearchOpen(false);
            }}
          />
        ) : null}
      </div>
      {recorded ? <Alert banner type="warning" showIcon message="此会话正在由服务端录制" /> : null}
      {error ? <Alert banner type="error" showIcon message={error} /> : null}
      <div className="terminal-stage">
        <XtermTerminal
          ref={xtermRef}
          session={sessionRef.current}
          onPasteShortcut={() => void requestPaste()}
          onSizeChange={handleSizeChange}
        />
        {status !== 'ready' ? (
          <div className="terminal-overlay">
            <strong>{connecting ? STATUS_LABELS[status] : unavailable ? '终端当前不可用' : STATUS_LABELS[status]}</strong>
            <span>{terminalAllowed === false ? '当前账户没有终端权限' : !device.online ? '设备离线' : !gatewayConnected ? '网关已断开' : connecting ? '可以取消本次连接' : '连接后可开始交互式 Shell 会话'}</span>
          </div>
        ) : null}
      </div>
      <footer className="terminal-statusbar">
        <span><i className={status === 'ready' ? 'is-ready' : ''} />{STATUS_LABELS[status]}</span>
        <span>{size.cols} × {size.rows}</span>
        <span>{latency === undefined ? '延迟 —' : `延迟 ${latency} ms`}</span>
        <span>会话 {durationText}</span>
        {recorded ? <Tag color="warning">REC</Tag> : null}
      </footer>
      <Modal
        title="确认粘贴到远程终端"
        open={pendingPaste !== undefined}
        okText="确认粘贴"
        cancelText="取消"
        onCancel={() => setPendingPaste(undefined)}
        onOk={() => {
          if (pendingPaste !== undefined) sessionRef.current?.write(pendingPaste);
          setPendingPaste(undefined);
          xtermRef.current?.focus();
        }}
      >
        <p>内容包含多行、控制字符或较长文本。确认后将直接发送到远端 Shell。</p>
        <div className="terminal-paste-meta">{pendingPaste?.length ?? 0} 个字符，{pendingPaste?.split(/\r\n|\r|\n/).length ?? 0} 行</div>
        <pre className="terminal-paste-preview">{pastePreview(pendingPaste ?? '')}</pre>
      </Modal>
    </section>
  );
}