import { CameraOutlined, CompressOutlined, CopyOutlined, DisconnectOutlined, FullscreenExitOutlined, FullscreenOutlined, SnippetsOutlined } from '@ant-design/icons';
import type { MeshCentralClient } from '@meshcentral/control-client';
import {
  DesktopSession,
  RELAY_PROTOCOLS,
  RelayAgentRouteError,
  RelayCancelledError,
  RelayClient,
  type DesktopSessionState,
} from '@meshcentral/relay';
import type { Device } from '@meshcentral/shared-state';
import { Alert, Button, Input, Modal, Select, Space, Tag, message } from 'antd';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MESH_CENTRAL_RELAY_URL } from '../../config/gateway';
import type { DeviceWorkspaceModel } from '../../features/device-workspace/types';
import { DesktopCanvas, type DesktopCanvasHandle } from './desktop/DesktopCanvas';
import { getRemoteClipboard, RemoteClipboardError, setRemoteClipboard } from './desktop/desktopClipboard';

type ConnectionState =
  | 'idle'
  | 'authorizing'
  | 'notifying'
  | 'connecting'
  | 'handshaking'
  | 'waiting-screen'
  | 'connected'
  | 'closed'
  | 'error';

const CONNECTING_STATES = new Set<ConnectionState>([
  'authorizing',
  'notifying',
  'connecting',
  'handshaking',
  'waiting-screen',
]);

const STATUS_KEYS: Record<ConnectionState, string> = {
  idle: 'idle',
  authorizing: 'authorizing',
  notifying: 'notifying',
  connecting: 'connecting',
  handshaking: 'handshaking',
  'waiting-screen': 'waitingScreen',
  connected: 'connected',
  closed: 'closed',
  error: 'error',
};

type DesktopAccess = 'denied' | 'view-only' | 'limited-input' | 'control';

interface RemoteDesktopPanelProps {
  model: DeviceWorkspaceModel;
  device: Device;
  meshCentralClient?: MeshCentralClient;
  controlConnected: boolean;
  desktopAccess?: DesktopAccess;
  keyboardEnabled: boolean;
  mouseEnabled: boolean;
  quality: number;
  scale: string;
  onScaleChange: (value: string) => void;
  onSessionActiveChange?: (active: boolean) => void;
  onLatencyChange?: (latencyMs: number | undefined) => void;
}

export interface RemoteDesktopPanelHandle {
  disconnect(): void;
}

function connectionErrorMessage(error: unknown): { code?: 'agentRoute' | 'cancelled' | 'relay'; raw?: string } {
  if (error instanceof RelayAgentRouteError) return { code: 'agentRoute' };
  if (error instanceof RelayCancelledError) return { code: 'cancelled' };
  return error instanceof Error ? { raw: error.message } : { code: 'relay' };
}

function clipboardErrorMessage(error: unknown, t: (key: string) => string): string {
  if (error instanceof RemoteClipboardError) return t(`deviceWorkspace.remoteDesktop.clipboardErrors.${error.code}`);
  return error instanceof Error ? error.message : t('deviceWorkspace.remoteDesktop.pasteFailed');
}

export const RemoteDesktopPanel = forwardRef<RemoteDesktopPanelHandle, RemoteDesktopPanelProps>(function RemoteDesktopPanel({
  model,
  device,
  meshCentralClient,
  controlConnected,
  desktopAccess,
  keyboardEnabled,
  mouseEnabled,
  quality,
  scale,
  onScaleChange,
  onSessionActiveChange,
  onLatencyChange,
}, ref) {
  const { t } = useTranslation();
  const [messageApi, messageContextHolder] = message.useMessage();
  const [status, setStatus] = useState<ConnectionState>('idle');
  const [error, setError] = useState<string>();
  const [screen, setScreen] = useState<{ width: number; height: number }>();
  const [recorded, setRecorded] = useState(false);
  const [desktopSession, setDesktopSession] = useState<DesktopSession>();
  const [fullscreen, setFullscreen] = useState(false);
  const [pasteModalOpen, setPasteModalOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [manualPasteRequired, setManualPasteRequired] = useState(false);
  const [pasteSubmitting, setPasteSubmitting] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<DesktopCanvasHandle>(null);
  const sessionRef = useRef<DesktopSession | undefined>(undefined);
  const abortRef = useRef<AbortController | undefined>(undefined);

  const disconnect = (reason = 'Desktop session closed.') => {
    abortRef.current?.abort();
    abortRef.current = undefined;
    sessionRef.current?.close(1000, reason);
    sessionRef.current = undefined;
    setDesktopSession(undefined);
    onSessionActiveChange?.(false);
    canvasRef.current?.clear();
    setScreen(undefined);
    setStatus((current) => (current === 'idle' ? current : 'closed'));
  };

  useImperativeHandle(ref, () => ({ disconnect: () => disconnect('Desktop session ended by user.') }));

  useEffect(() => () => disconnect('Desktop panel unmounted.'), []);
  useEffect(() => {
    disconnect('Desktop device changed.');
    setStatus('idle');
    setScreen(undefined);
    setError(undefined);
  }, [device.id, meshCentralClient]);
  useEffect(() => {
    if (!controlConnected && (sessionRef.current || abortRef.current)) {
      disconnect('Nodex RMM control connection was lost.');
      setError(t('deviceWorkspace.remoteDesktop.gatewayDisconnected'));
    }
  }, [controlConnected]);
  useEffect(() => {
    const handleFullscreenChange = () => setFullscreen(document.fullscreenElement === shellRef.current);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    handleFullscreenChange();
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);
  useEffect(() => {
    if (!desktopSession || !screen) return;
    const timeout = window.setTimeout(() => {
      try {
        desktopSession.setCompression({ quality });
      } catch (compressionError) {
        if (sessionRef.current === desktopSession) {
          void messageApi.error(compressionError instanceof Error ? compressionError.message : t('deviceWorkspace.remoteDesktop.qualityUpdateFailed'));
        }
      }
    }, 150);
    return () => window.clearTimeout(timeout);
  }, [desktopSession, messageApi, quality, screen]);

  const connect = async () => {
    if (CONNECTING_STATES.has(status) || status === 'connected') return;
    if (!device.online || !controlConnected || !meshCentralClient || desktopAccess === 'denied') {
      setError(
        desktopAccess === 'denied'
          ? t('deviceWorkspace.remoteDesktop.permissionDenied')
          : !device.online
            ? t('deviceWorkspace.remoteDesktop.deviceOffline')
            : t('deviceWorkspace.remoteDesktop.gatewayUnavailable'),
      );
      setStatus('error');
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setStatus('connecting');
    setError(undefined);
    setScreen(undefined);
    canvasRef.current?.clear();

    try {
      const relay = await new RelayClient({ baseUrl: MESH_CENTRAL_RELAY_URL, control: meshCentralClient }).createSession({
        deviceId: device.id,
        protocol: RELAY_PROTOCOLS.desktop,
        usage: 2,
        signal: controller.signal,
        createStartupMessages: () => ['2'],
        onStateChange: ({ current }) => {
          if (current !== 'ready') setStatus(current as ConnectionState);
        },
        onHandshakeMessage: (message) => setRecorded(message === 'cr'),
      });

      if (controller.signal.aborted) {
        relay.cancel('Desktop connection was cancelled.');
        return;
      }

      const inputAllowed = desktopAccess !== 'view-only';
      const session = new DesktopSession(relay, { inputAllowed });
      sessionRef.current = session;
      setDesktopSession(session);
      onSessionActiveChange?.(true);
      setStatus('waiting-screen');
      session.onScreenSize((nextScreen) => {
        setScreen(nextScreen);
        canvasRef.current?.setScreen(nextScreen);
      });
      session.onTile((nextTile) => canvasRef.current?.drawTile(nextTile));
      session.onLatencyChange((latencyMs) => onLatencyChange?.(latencyMs));
      session.onStateChange((next: DesktopSessionState) => {
        if (next === 'screen-known') setStatus('waiting-screen');
        if (next === 'desktop-ready') setStatus('connected');
        if (next === 'closed' || next === 'error') {
          setStatus(next);
          setDesktopSession(undefined);
          onSessionActiveChange?.(false);
        }
      });
      session.onError((next) => {
        setError(next.message);
        setStatus('error');
      });
    } catch (connectionError) {
      if (!controller.signal.aborted) {
        onSessionActiveChange?.(false);
        const connectionFailure = connectionErrorMessage(connectionError);
        setError(connectionFailure.raw ?? t(`deviceWorkspace.remoteDesktop.errors.${connectionFailure.code}`));
        setStatus('error');
      }
    }
  };

  const saveScreenshot = () => {
    const canvas = shellRef.current?.querySelector('canvas');
    if (!(canvas instanceof HTMLCanvasElement)) return;
    const link = document.createElement('a');
    link.download = `${model.hostname}-desktop.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const toggleFullscreen = async () => {
    if (!shellRef.current) return;
    if (document.fullscreenElement) await document.exitFullscreen();
    else await shellRef.current.requestFullscreen();
  };

  const pasteLocalClipboardToRemote = async () => {
    if (!meshCentralClient || !desktopSession) return;
    try {
      const text = await navigator.clipboard.readText();
      if (!text) {
        void messageApi.info(t('deviceWorkspace.remoteDesktop.localClipboardEmpty'));
        return;
      }
      setPasteText(text);
      setManualPasteRequired(false);
    } catch {
      setPasteText('');
      setManualPasteRequired(true);
    }
    setPasteModalOpen(true);
  };

  const submitClipboardToRemote = async () => {
    if (!meshCentralClient || !desktopSession || !pasteText) return;
    setPasteSubmitting(true);
    try {
      if (sessionRef.current !== desktopSession) throw new Error(t('deviceWorkspace.remoteDesktop.sessionClosed'));
      setRemoteClipboard(meshCentralClient, device.id, pasteText);
      await new Promise((resolve) => window.setTimeout(resolve, 150));
      if (sessionRef.current !== desktopSession) throw new Error(t('deviceWorkspace.remoteDesktop.sessionClosed'));
      desktopSession.sendKey(17, 'down');
      desktopSession.sendKey(86, 'down');
      desktopSession.sendKey(86, 'up');
      desktopSession.sendKey(17, 'up');
      setPasteModalOpen(false);
      setPasteText('');
      void messageApi.success(t('deviceWorkspace.remoteDesktop.clipboardSubmitted'));
    } catch (clipboardError) {
      void messageApi.error(clipboardErrorMessage(clipboardError, t));
    } finally {
      setPasteSubmitting(false);
    }
  };

  const copyRemoteClipboardToLocal = async () => {
    if (!meshCentralClient || !desktopSession) return;
    try {
      if (desktopAccess !== 'denied' && desktopAccess !== 'view-only') {
        desktopSession.sendKey(17, 'down');
        desktopSession.sendKey(67, 'down');
        desktopSession.sendKey(67, 'up');
        desktopSession.sendKey(17, 'up');
        await new Promise((resolve) => window.setTimeout(resolve, 200));
      }
      const text = await getRemoteClipboard(meshCentralClient, device.id);
      await navigator.clipboard.writeText(text);
      void messageApi.success(t('deviceWorkspace.remoteDesktop.clipboardCopied', { count: text.length }));
    } catch (clipboardError) {
      void messageApi.error(clipboardErrorMessage(clipboardError, t));
    }
  };

  const unavailable = !device.online || !controlConnected || desktopAccess === 'denied';
  const canDisconnect = Boolean(sessionRef.current) || CONNECTING_STATES.has(status);

  return (
    <div className="workspace-center-column">
      {messageContextHolder}
      <section className="console-card remote-desktop-card" ref={shellRef}>
        <div className="remote-toolbar">
          <Button type="primary" size="small" icon={fullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />} onClick={() => void toggleFullscreen()} disabled={!screen}>
            {fullscreen ? t('deviceWorkspace.remoteDesktop.exitFullscreen') : t('deviceWorkspace.remoteDesktop.fullscreen')}
          </Button>
          <Button size="small" icon={<CameraOutlined />} onClick={saveScreenshot} disabled={!screen}>
            {t('deviceWorkspace.remoteDesktop.screenshot')}
          </Button>
          <Button size="small" icon={<DisconnectOutlined />} onClick={() => disconnect()} disabled={!canDisconnect}>
            {t('deviceWorkspace.remoteDesktop.endSession')}
          </Button>
          <Button size="small" icon={<CompressOutlined />} onClick={() => desktopSession?.sendCad()} disabled={!desktopSession || desktopAccess === 'denied' || desktopAccess === 'view-only'}>
            Ctrl+Alt+Del
          </Button>
          <Button size="small" icon={<SnippetsOutlined />} onClick={() => void pasteLocalClipboardToRemote()} disabled={!desktopSession || !meshCentralClient || desktopAccess === 'denied' || desktopAccess === 'view-only'}>
            {t('deviceWorkspace.remoteDesktop.pasteRemote')}
          </Button>
          <Button size="small" icon={<CopyOutlined />} onClick={() => void copyRemoteClipboardToLocal()} disabled={!desktopSession || !meshCentralClient}>
            {t('deviceWorkspace.remoteDesktop.copyLocal')}
          </Button>
          <Space size={6}>
            <Button type="primary" size="small" onClick={() => void connect()} disabled={unavailable || CONNECTING_STATES.has(status) || status === 'connected'}>
              {CONNECTING_STATES.has(status) ? t('deviceWorkspace.remoteDesktop.connecting') : t('deviceWorkspace.remoteDesktop.connect')}
            </Button>
            {desktopAccess === 'view-only' && <Tag color="gold">{t('deviceWorkspace.remoteDesktop.viewOnly')}</Tag>}
            {desktopAccess === 'limited-input' && <Tag color="orange">{t('deviceWorkspace.remoteDesktop.limitedInput')}</Tag>}
            {desktopAccess === undefined && <Tag>{t('deviceWorkspace.remoteDesktop.accessPending')}</Tag>}
            {recorded && <Tag color="blue">{t('deviceWorkspace.remoteDesktop.recorded')}</Tag>}
          </Space>
        </div>
        <div className="remote-status-row">
          <span>
            <i /> {t(`deviceWorkspace.remoteDesktop.status.${STATUS_KEYS[status]}`)}
            {screen ? ` · ${screen.width} × ${screen.height}` : ''}
            {error ? ` · ${error}` : ''}
          </span>
          <Select
            size="small"
            value={scale}
            onChange={onScaleChange}
            options={[
              { value: 'fit', label: t('deviceWorkspace.remoteDesktop.fitWindow') },
              { value: '100', label: '100%' },
              { value: '75', label: '75%' },
            ]}
          />
        </div>
        {error && <Alert type="error" showIcon title={error} action={<Button size="small" onClick={() => void connect()}>{t('common.actions.retry')}</Button>} />}
        <div className="remote-screen-shell">
          <div className="remote-screen" data-scale={scale}>
            <DesktopCanvas
              ref={canvasRef}
              scale={scale}
              session={desktopSession}
              keyboardEnabled={keyboardEnabled && desktopAccess !== 'denied' && desktopAccess !== 'view-only'}
              mouseEnabled={mouseEnabled && desktopAccess !== 'denied' && desktopAccess !== 'view-only'}
              onReady={() => setStatus('connected')}
              onDecodeError={(decodeError) => setError(decodeError.message)}
            />
            {!screen && (
              <div className="remote-empty">
                {unavailable ? t('deviceWorkspace.remoteDesktop.unavailable') : CONNECTING_STATES.has(status) ? t('deviceWorkspace.remoteDesktop.establishing') : t('deviceWorkspace.remoteDesktop.connectToView')}
              </div>
            )}
          </div>
        </div>
      </section>
      <Modal
        title={t('deviceWorkspace.remoteDesktop.pasteTitle')}
        open={pasteModalOpen}
        okText={t('deviceWorkspace.remoteDesktop.pasteRemote')}
        cancelText={t('common.actions.cancel')}
        okButtonProps={{ disabled: !pasteText }}
        confirmLoading={pasteSubmitting}
        onCancel={() => {
          setPasteModalOpen(false);
          setPasteText('');
        }}
        onOk={() => void submitClipboardToRemote()}
      >
        {manualPasteRequired && <Alert type="info" showIcon title={t('deviceWorkspace.remoteDesktop.manualPaste')} />}
        <Input.TextArea
          autoFocus
          value={pasteText}
          onChange={(event) => setPasteText(event.target.value)}
          placeholder={t('deviceWorkspace.remoteDesktop.pastePlaceholder')}
          autoSize={{ minRows: 4, maxRows: 12 }}
          style={{ marginTop: manualPasteRequired ? 12 : 0 }}
        />
        <div style={{ marginTop: 8 }}>{t('deviceWorkspace.remoteDesktop.pasteSummary', { hostname: model.hostname, count: pasteText.length })}</div>
      </Modal>
    </div>
  );
});
