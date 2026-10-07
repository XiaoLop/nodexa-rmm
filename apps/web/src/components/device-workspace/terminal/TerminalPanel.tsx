import {
  ClearOutlined,
  CloseOutlined,
  CopyOutlined,
  DisconnectOutlined,
  ExpandOutlined,
  LinkOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import type { MeshCentralClient } from '@meshcentral/control-client';
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
import { useTranslation } from 'react-i18next';
import { MESH_CENTRAL_RELAY_URL } from '../../../config/gateway';
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

const STATUS_KEYS: Record<TerminalConnectionState, string> = {
  idle: 'idle',
  authorizing: 'authorizing',
  notifying: 'notifying',
  connecting: 'connecting',
  handshaking: 'handshaking',
  ready: 'ready',
  closed: 'closed',
  error: 'error',
};

interface TerminalPanelProps {
  device: Device;
  meshCentralClient?: MeshCentralClient;
  controlConnected: boolean;
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

function connectionErrorMessage(error: unknown): { code?: 'agentRoute' | 'cancelled' | 'relay'; raw?: string } {
  if (error instanceof RelayAgentRouteError) {
    return { code: 'agentRoute' };
  }
  if (error instanceof RelayCancelledError) return { code: 'cancelled' };
  return error instanceof Error ? { raw: error.message } : { code: 'relay' };
}

export function TerminalPanel({ device, meshCentralClient, controlConnected, terminalAllowed }: TerminalPanelProps) {
  const { t } = useTranslation();
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
  }, [device.id, meshCentralClient]);
  useEffect(() => {
    if (controlConnected || (!sessionRef.current && !abortRef.current)) return;
    disconnect('Nodex RMM control connection was lost.');
    setError(t('deviceWorkspace.terminal.gatewayDisconnected'));
  }, [controlConnected]);
  useEffect(() => {
    if (!startedAt || status !== 'ready') return;
    const update = () => setDuration(Math.floor((Date.now() - startedAt) / 1000));
    update();
    const timer = setInterval(update, 1_000);
    return () => clearInterval(timer);
  }, [startedAt, status]);

  const connect = async () => {
    if (CONNECTING_STATES.has(status) || status === 'ready') return;
    if (!device.online || !controlConnected || !meshCentralClient || terminalAllowed === false) {
      setError(
        terminalAllowed === false
          ? t('deviceWorkspace.terminal.permissionDenied')
          : !device.online
            ? t('deviceWorkspace.terminal.deviceOffline')
            : t('deviceWorkspace.terminal.gatewayUnavailable'),
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
      const relayClient = new RelayClient({ baseUrl: MESH_CENTRAL_RELAY_URL, control: meshCentralClient });
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
      xtermRef.current?.writeLocal(`\r\n\x1b[32m${t('deviceWorkspace.terminal.sessionEstablished')}\x1b[0m\r\n`);
      xtermRef.current?.focus();
    } catch (connectionError) {
      if (controller.signal.aborted) {
        setStatus('closed');
        return;
      }
      const connectionFailure = connectionErrorMessage(connectionError);
      setError(connectionFailure.raw ?? t(`deviceWorkspace.terminal.errors.${connectionFailure.code}`));
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
      void messageApi.error(t('deviceWorkspace.terminal.clipboardReadFailed'));
    }
  };

  const copySelection = async () => {
    const selection = xtermRef.current?.getSelection() ?? '';
    if (!selection) {
      void messageApi.info(t('deviceWorkspace.terminal.selectTextFirst'));
      return;
    }
    try {
      await navigator.clipboard.writeText(selection);
      void messageApi.success(t('deviceWorkspace.terminal.selectionCopied'));
    } catch {
      void messageApi.error(t('deviceWorkspace.terminal.clipboardWriteFailed'));
    }
  };

  const toggleFullscreen = async () => {
    if (!shellRef.current) return;
    if (document.fullscreenElement) await document.exitFullscreen();
    else await shellRef.current.requestFullscreen();
  };

  const durationText = `${String(Math.floor(duration / 60)).padStart(2, '0')}:${String(duration % 60).padStart(2, '0')}`;
  const unavailable = !device.online || !controlConnected || terminalAllowed === false;
  const connecting = CONNECTING_STATES.has(status);

  return (
    <section ref={shellRef} className="console-card terminal-panel">
      {messageContextHolder}
      <div className="terminal-toolbar">
        <Space size={4}>
          {connecting ? (
            <Button icon={<CloseOutlined />} onClick={cancelConnection}>
              {t('deviceWorkspace.terminal.cancelConnection')}
            </Button>
          ) : status !== 'ready' ? (
            <Button
              type="primary"
              icon={<LinkOutlined />}
              disabled={unavailable}
              onClick={() => void connect()}
            >
              {t('deviceWorkspace.terminal.connect')}
            </Button>
          ) : (
            <Button icon={<DisconnectOutlined />} danger onClick={() => disconnect('User disconnected terminal session.')}>
              {t('deviceWorkspace.terminal.disconnect')}
            </Button>
          )}
          <Tooltip title={t('deviceWorkspace.terminal.searchBuffer')}><Button aria-label={t('deviceWorkspace.terminal.searchBuffer')} icon={<SearchOutlined />} onClick={() => setSearchOpen((value) => !value)} /></Tooltip>
          <Tooltip title={t('deviceWorkspace.terminal.copySelection')}><Button aria-label={t('deviceWorkspace.terminal.copySelection')} icon={<CopyOutlined />} onClick={() => void copySelection()} /></Tooltip>
          <Tooltip title={t('deviceWorkspace.terminal.paste')}><Button aria-label={t('deviceWorkspace.terminal.paste')} onClick={() => void requestPaste()}>{t('deviceWorkspace.terminal.paste')}</Button></Tooltip>
          <Tooltip title={t('deviceWorkspace.terminal.clear')}><Button aria-label={t('deviceWorkspace.terminal.clear')} icon={<ClearOutlined />} onClick={() => xtermRef.current?.clear()} /></Tooltip>
          <Tooltip title={t('deviceWorkspace.terminal.fullscreen')}><Button aria-label={t('deviceWorkspace.terminal.fullscreen')} icon={<ExpandOutlined />} onClick={() => void toggleFullscreen()} /></Tooltip>
        </Space>
        {searchOpen ? (
          <Input
            autoFocus
            allowClear
            size="small"
            prefix={<SearchOutlined />}
            placeholder={t('deviceWorkspace.terminal.searchPlaceholder')}
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onPressEnter={() => xtermRef.current?.searchNext(searchQuery)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setSearchOpen(false);
            }}
          />
        ) : null}
      </div>
      {recorded ? <Alert banner type="warning" showIcon title={t('deviceWorkspace.terminal.recordedNotice')} /> : null}
      {error ? <Alert banner type="error" showIcon title={error} /> : null}
      <div className="terminal-stage">
        <XtermTerminal
          ref={xtermRef}
          session={sessionRef.current}
          onPasteShortcut={() => void requestPaste()}
          onSizeChange={handleSizeChange}
        />
        {status !== 'ready' ? (
          <div className="terminal-overlay">
            <strong>{connecting ? t(`deviceWorkspace.terminal.status.${STATUS_KEYS[status]}`) : unavailable ? t('deviceWorkspace.terminal.unavailable') : t(`deviceWorkspace.terminal.status.${STATUS_KEYS[status]}`)}</strong>
            <span>{terminalAllowed === false ? t('deviceWorkspace.terminal.noPermission') : !device.online ? t('deviceWorkspace.terminal.deviceOfflineShort') : !controlConnected ? t('deviceWorkspace.terminal.gatewayDisconnectedShort') : connecting ? t('deviceWorkspace.terminal.cancelHint') : t('deviceWorkspace.terminal.interactiveHint')}</span>
          </div>
        ) : null}
      </div>
      <footer className="terminal-statusbar">
        <span><i className={status === 'ready' ? 'is-ready' : ''} />{t(`deviceWorkspace.terminal.status.${STATUS_KEYS[status]}`)}</span>
        <span>{size.cols} × {size.rows}</span>
        <span>{latency === undefined ? t('deviceWorkspace.terminal.latencyUnknown') : t('deviceWorkspace.terminal.latency', { value: latency })}</span>
        <span>{t('deviceWorkspace.terminal.sessionDuration', { value: durationText })}</span>
        {recorded ? <Tag color="warning">REC</Tag> : null}
      </footer>
      <Modal
        title={t('deviceWorkspace.terminal.confirmPasteTitle')}
        open={pendingPaste !== undefined}
        okText={t('deviceWorkspace.terminal.confirmPaste')}
        cancelText={t('common.actions.cancel')}
        onCancel={() => setPendingPaste(undefined)}
        onOk={() => {
          if (pendingPaste !== undefined) sessionRef.current?.write(pendingPaste);
          setPendingPaste(undefined);
          xtermRef.current?.focus();
        }}
      >
        <p>{t('deviceWorkspace.terminal.confirmPasteDescription')}</p>
        <div className="terminal-paste-meta">{t('deviceWorkspace.terminal.pasteMeta', { characters: pendingPaste?.length ?? 0, lines: pendingPaste?.split(/\r\n|\r|\n/).length ?? 0 })}</div>
        <pre className="terminal-paste-preview">{pastePreview(pendingPaste ?? '')}</pre>
      </Modal>
    </section>
  );
}