import { useDesktopCompression } from './desktop/useDesktopCompression';
import { DESKTOP_PRESETS, desktopCompression, type DesktopPreset } from './desktop/desktopSettings';
import type { DesktopRenderStats } from './desktop/DesktopRenderQueue';
import {
  AppstoreOutlined,
  CameraOutlined,
  CodeOutlined,
  CopyOutlined,
  DesktopOutlined,
  DisconnectOutlined,
  FolderOpenOutlined,
  FullscreenExitOutlined,
  FullscreenOutlined,
  LoadingOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  SettingOutlined,
  SnippetsOutlined,
  WindowsOutlined,
} from '@ant-design/icons';
import type { MeshCentralClient } from '@meshcentral/control-client';
import {
  DesktopSession,
  RELAY_PROTOCOLS,
  RelayAgentRouteError,
  RelayCancelledError,
  RelayClient,
  type DesktopSessionState,
  type DesktopSessionStats,
} from '@meshcentral/relay';
import type { Device } from '@meshcentral/shared-state';
import {
  Alert,
  Button,
  Input,
  Modal,
  Select,
  Slider,
  Switch,
  Tooltip,
  message,
} from 'antd';
import { useCallback, forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MESH_CENTRAL_RELAY_URL } from '../../config/gateway';
import type { DeviceWorkspaceModel } from '../../features/device-workspace/types';
import type { WorkspaceSettingsValue } from './WorkspaceSettings';
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
  settings: WorkspaceSettingsValue;
  onSettingsChange: (settings: WorkspaceSettingsValue) => void;
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
  settings,
  onSettingsChange,
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
  const [transport, setTransport] = useState<'websocket' | 'webrtc'>('websocket');
  const samplesRef = useRef<Array<Record<string, unknown>>>([]);
  const [performanceStats, setPerformanceStats] = useState<{
    relay: DesktopSessionStats; render?: DesktopRenderStats; webrtc?: string; bytesPerSecond: number;
  }>();
  const [desktopSession, setDesktopSession] = useState<DesktopSession>();
  const [fullscreen, setFullscreen] = useState(false);
  const [pasteModalOpen, setPasteModalOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [manualPasteRequired, setManualPasteRequired] = useState(false);
  const [pasteSubmitting, setPasteSubmitting] = useState(false);
  const [currentLatency, setCurrentLatency] = useState<number>();
  const settingsRefForStats = useRef(settings);
  settingsRefForStats.current = settings;
  const latencyRef = useRef(currentLatency);
  latencyRef.current = currentLatency;
  const screenRefForStats = useRef(screen);
  screenRefForStats.current = screen;
  const shellRef = useRef<HTMLDivElement>(null);
  const screenContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<DesktopCanvasHandle>(null);
  const sessionRef = useRef<DesktopSession | undefined>(undefined);
  const abortRef = useRef<AbortController | undefined>(undefined);
  const disconnect = (reason = 'Desktop session closed.') => {
    abortRef.current?.abort();
    abortRef.current = undefined;
    sessionRef.current?.close(1000, reason);
    sessionRef.current = undefined;
    setDesktopSession(undefined);
    setCurrentLatency(undefined);
    onLatencyChange?.(undefined);
    onSessionActiveChange?.(false);
    canvasRef.current?.clear();
    setScreen(undefined);
    setStatus((current) => (current === 'idle' ? current : 'closed'));
  };

  useImperativeHandle(ref, () => ({ disconnect: () => disconnect('Desktop session ended by user.') }));

  useEffect(() => {
    const container = screenContainerRef.current;
    if (!container) return;
    // React wheel listeners are passive; use a native listener to prevent page scrolling.
    const preventOuterScroll = (event: WheelEvent) => event.preventDefault();
    container.addEventListener('wheel', preventOuterScroll, { passive: false });
    return () => container.removeEventListener('wheel', preventOuterScroll);
  }, []);

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

  const onCompressionError = useCallback((compressionError: unknown) => {
    void messageApi.error(compressionError instanceof Error ? compressionError.message : t('deviceWorkspace.remoteDesktop.qualityUpdateFailed'));
  }, [messageApi, t]);
  useDesktopCompression(desktopSession, !!screen, settings, onCompressionError);

  useEffect(() => {
    setPerformanceStats(undefined);
    samplesRef.current = [];
    if (!desktopSession) return;
    let latest = desktopSession.stats;
    let previousBytes = latest.receivedBytes;
    let previousTime = performance.now();
    const started = previousTime;
    const remove = desktopSession.onStats(stats => { latest = stats; });
    const timer = window.setInterval(() => {
      const now = performance.now();
      const render = canvasRef.current?.getStats();
      setPerformanceStats({ relay: latest, render,
        webrtc: desktopSession.webrtcState,
        bytesPerSecond: (latest.receivedBytes - previousBytes) * 1000 / Math.max(1, now - previousTime) });
      samplesRef.current.push({ elapsedMs: now - started, received: latest,
        render, transport: desktopSession.transport, webrtc: desktopSession.webrtcState,
        rttMs: latencyRef.current, screen: screenRefForStats.current,
        compression: desktopCompression(settingsRefForStats.current) });
      if (samplesRef.current.length > 300) samplesRef.current.shift();
      previousBytes = latest.receivedBytes;
      previousTime = now;
    }, 1000);
    return () => { remove(); window.clearInterval(timer); };
  }, [desktopSession]);

  const exportPerformance = () => {
    const blob = new Blob([JSON.stringify({ schemaVersion: 1, samples: samplesRef.current }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = 'desktop-performance.json';
    link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

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
      const session = new DesktopSession(relay, {
        inputAllowed,
        webrtc: {
          enabled: true,
        },
      });
      sessionRef.current = session;
      setDesktopSession(session);
      setTransport(session.transport);
      onSessionActiveChange?.(true);
      setStatus('waiting-screen');
      session.onTransportChange((nextTransport) => setTransport(nextTransport));
      session.onScreenSize((nextScreen) => {
        setScreen(nextScreen);
        canvasRef.current?.setScreen(nextScreen);
      });
      session.onTile((nextTile) => canvasRef.current?.drawTile(nextTile));
      session.onLatencyChange((latencyMs) => {
        setCurrentLatency(latencyMs);
        onLatencyChange?.(latencyMs);
      });
      session.onStateChange((next: DesktopSessionState) => {
        if (next === 'screen-known') setStatus('waiting-screen');
        if (next === 'desktop-ready') setStatus('connected');
        if (next === 'closed' || next === 'error') {
          canvasRef.current?.clear();
          setScreen(undefined);
          setStatus(next);
          setDesktopSession(undefined);
          setCurrentLatency(undefined);
          onLatencyChange?.(undefined);
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

  const sendKeyCombo = (keys: Array<{ keyCode: number; extended?: boolean }>) => {
    if (!desktopSession || desktopAccess === 'denied' || desktopAccess === 'view-only') return;
    for (const key of keys) desktopSession.sendKey(key.keyCode, 'down', key.extended);
    for (let i = keys.length - 1; i >= 0; i--) desktopSession.sendKey(keys[i]!.keyCode, 'up', keys[i]!.extended);
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
  const isConnected = status === 'connected';
  const isConnecting = CONNECTING_STATES.has(status);
  const canDisconnect = Boolean(sessionRef.current) || isConnecting;
  const inputAllowed = settings.keyboard && desktopAccess !== 'denied' && desktopAccess !== 'view-only';

  const getPopupContainer = () => shellRef.current ?? document.body;

  const statusTooltip = (
    <div>
      <div>{t(`deviceWorkspace.remoteDesktop.status.${STATUS_KEYS[status]}`)}</div>
      {screen && <div>{screen.width} × {screen.height}</div>}
      {desktopSession && <div>{transport === 'webrtc' ? 'WebRTC DataChannel' : t('deviceWorkspace.remoteDesktop.websocketRelay')}</div>}
      {recorded && <div>{t('deviceWorkspace.remoteDesktop.recorded')}</div>}
      {desktopAccess === 'view-only' && <div>{t('deviceWorkspace.remoteDesktop.viewOnly')}</div>}
    </div>
  );

  return (
    <div className="workspace-center-column">
      {messageContextHolder}
      <section className="console-card remote-desktop-card" ref={shellRef}>
        <aside className="remote-desktop-toolbar" aria-label={t('deviceWorkspace.remoteDesktop.settings')}>
          {/* 1. 会话状态与主连接操作卡片 */}
          <div className="remote-status-card">
            <div className="remote-status-main">
              <Tooltip title={statusTooltip} getPopupContainer={getPopupContainer}>
                <div className="remote-desktop-status">
                  <i className={`status-dot ${isConnected ? 'connected' : isConnecting ? 'connecting' : status === 'error' ? 'error' : ''}`} />
                  <span>
                    {isConnecting ? (
                      <>
                        <LoadingOutlined spin style={{ marginRight: 4 }} />
                        {t('deviceWorkspace.remoteDesktop.connecting')}
                      </>
                    ) : (
                      t(`deviceWorkspace.remoteDesktop.status.${STATUS_KEYS[status]}`)
                    )}
                  </span>
                </div>
              </Tooltip>
              {currentLatency !== undefined && (
                <span className={`remote-desktop-latency ${currentLatency > 200 ? 'high' : ''}`}>
                  {currentLatency} ms
                </span>
              )}
            </div>

            {screen && (
              <div className="remote-status-tags">
                <span className="remote-status-resolution">{screen.width} × {screen.height}</span>
                <span className="remote-status-resolution">{transport === 'webrtc' ? 'WebRTC' : 'WS Relay'}</span>
              </div>
            )}

            {!isConnected && !isConnecting ? (
              <Button
                type="primary"
                size="middle"
                className="remote-primary-action-btn"
                icon={<PlayCircleOutlined />}
                onClick={() => void connect()}
                disabled={unavailable}
              >
                {t('deviceWorkspace.remoteDesktop.connect')}
              </Button>
            ) : (
              <Button
                danger
                size="middle"
                className="remote-primary-action-btn"
                icon={<DisconnectOutlined />}
                onClick={() => disconnect()}
                disabled={!canDisconnect}
              >
                {isConnecting ? t('common.actions.cancel') : t('deviceWorkspace.remoteDesktop.endSession')}
              </Button>
            )}
          </div>

          {/* 2. 快捷指令矩阵 */}
          <div className="remote-toolbar-card">
            <div className="remote-toolbar-card-header">{t('deviceWorkspace.remoteDesktop.shortcutsCardTitle')}</div>
            <div className="remote-shortcuts-grid">
              <Tooltip title={t('deviceWorkspace.remoteDesktop.winKey')} getPopupContainer={getPopupContainer}>
                <Button
                  size="small"
                  icon={<WindowsOutlined />}
                  disabled={!desktopSession || !inputAllowed}
                  onClick={() => sendKeyCombo([{ keyCode: 91, extended: true }])}
                >
                  Win 键
                </Button>
              </Tooltip>
              <Tooltip title={t('deviceWorkspace.remoteDesktop.taskManager')} getPopupContainer={getPopupContainer}>
                <Button
                  size="small"
                  icon={<AppstoreOutlined />}
                  disabled={!desktopSession || !inputAllowed}
                  onClick={() =>
                    sendKeyCombo([
                      { keyCode: 17 }, // Ctrl
                      { keyCode: 16 }, // Shift
                      { keyCode: 27 }, // Esc
                    ])
                  }
                >
                  任务管理
                </Button>
              </Tooltip>
              <Tooltip title={t('deviceWorkspace.remoteDesktop.fileExplorer')} getPopupContainer={getPopupContainer}>
                <Button
                  size="small"
                  icon={<FolderOpenOutlined />}
                  disabled={!desktopSession || !inputAllowed}
                  onClick={() =>
                    sendKeyCombo([
                      { keyCode: 91, extended: true }, // Win
                      { keyCode: 69 }, // E
                    ])
                  }
                >
                  资源管理
                </Button>
              </Tooltip>
              <Tooltip title={t('deviceWorkspace.remoteDesktop.windowsSettings')} getPopupContainer={getPopupContainer}>
                <Button
                  size="small"
                  icon={<SettingOutlined />}
                  disabled={!desktopSession || !inputAllowed}
                  onClick={() =>
                    sendKeyCombo([
                      { keyCode: 91, extended: true }, // Win
                      { keyCode: 73 }, // I
                    ])
                  }
                >
                  系统设置
                </Button>
              </Tooltip>
              <Tooltip title={t('deviceWorkspace.remoteDesktop.runDialog')} getPopupContainer={getPopupContainer}>
                <Button
                  size="small"
                  icon={<CodeOutlined />}
                  disabled={!desktopSession || !inputAllowed}
                  onClick={() =>
                    sendKeyCombo([
                      { keyCode: 91, extended: true }, // Win
                      { keyCode: 82 }, // R
                    ])
                  }
                >
                  运行窗口
                </Button>
              </Tooltip>
              <Tooltip title={t('deviceWorkspace.remoteDesktop.showDesktop')} getPopupContainer={getPopupContainer}>
                <Button
                  size="small"
                  icon={<DesktopOutlined />}
                  disabled={!desktopSession || !inputAllowed}
                  onClick={() =>
                    sendKeyCombo([
                      { keyCode: 91, extended: true }, // Win
                      { keyCode: 68 }, // D
                    ])
                  }
                >
                  显示桌面
                </Button>
              </Tooltip>
              <Tooltip title={t('deviceWorkspace.remoteDesktop.qualityUpdateFailed', '重新请求远端全屏画面')} getPopupContainer={getPopupContainer}>
                <Button
                  size="small"
                  icon={<ReloadOutlined />}
                  disabled={!desktopSession}
                  style={{ gridColumn: 'span 2' }}
                  onClick={() => {
                    try {
                      desktopSession?.setCompression({
                        imageFormat: settings.imageFormat,
                        quality: settings.quality,
                        scaling: 1024,
                        frameTimer: settings.frameTimer,
                      });
                      void messageApi.success(t('deviceWorkspace.remoteDesktop.qualityUpdateFailed', '画面刷新指令已发送'));
                    } catch (e) {
                      void messageApi.error(e instanceof Error ? e.message : '刷新失败');
                    }
                  }}
                >
                  刷新画面
                </Button>
              </Tooltip>
            </div>
          </div>

          {/* 3. 输入控制配置 */}
          <div className="remote-toolbar-card">
            <div className="remote-toolbar-card-header">{t('deviceWorkspace.remoteDesktop.inputCardTitle')}</div>
            <div className="remote-settings-compact">
              <div className="remote-setting-item">
                <span>{t('deviceWorkspace.remoteDesktop.keyboardInput')}</span>
                <Switch
                  size="small"
                  checked={settings.keyboard}
                  disabled={desktopAccess === 'denied' || desktopAccess === 'view-only'}
                  onChange={(checked) => onSettingsChange({ ...settings, keyboard: checked })}
                />
              </div>
              <div className="remote-setting-item">
                <span>{t('deviceWorkspace.remoteDesktop.mouseInput')}</span>
                <Switch
                  size="small"
                  checked={settings.mouse}
                  disabled={desktopAccess === 'denied' || desktopAccess === 'view-only'}
                  onChange={(checked) => onSettingsChange({ ...settings, mouse: checked })}
                />
              </div>
            </div>
          </div>

          {/* 4. 显示与画质配置 */}
          <div className="remote-toolbar-card">
            <div className="remote-toolbar-card-header">{t('deviceWorkspace.remoteDesktop.displayCardTitle')}</div>
            <div className="remote-settings-compact">
              <div className="remote-setting-item">
                <span>{t('deviceWorkspace.remoteDesktop.preset')}</span>
                <Select size="small" value={settings.preset ?? 'custom'} style={{ width: 110 }}
                  onChange={(preset: DesktopPreset) => onSettingsChange({ ...settings, preset,
                    ...(preset === 'custom' ? {} : DESKTOP_PRESETS[preset]) })}
                  options={(['smooth', 'balanced', 'clear', 'custom'] as const).map(value => ({ value,
                    label: t('deviceWorkspace.remoteDesktop.presets.' + value) }))} />
              </div>
              <div className="remote-setting-item">
                <Tooltip title={t('deviceWorkspace.remoteDesktop.scaleUnverified')}>
                  <span>{t('deviceWorkspace.remoteDesktop.transportScale')}</span>
                </Tooltip>
                <Select size="small" value={100} style={{ width: 110 }} disabled options={[
                  { value: 100, label: '100%' }, { value: 75, label: '75%', disabled: true },
                  { value: 50, label: '50%', disabled: true },
                ]} />
              </div>
              <div className="remote-setting-item">
                <span>{t('deviceWorkspace.remoteDesktop.scaleMode')}</span>
                <Select
                  size="small"
                  value={scale}
                  style={{ width: 110 }}
                  getPopupContainer={getPopupContainer}
                  onChange={onScaleChange}
                  options={[
                    { value: 'fit', label: t('deviceWorkspace.remoteDesktop.fitWindow') },
                    { value: '100', label: t('deviceWorkspace.remoteDesktop.originalSize') },
                    { value: 'stretch', label: t('deviceWorkspace.remoteDesktop.stretch') },
                    { value: '75', label: '75%' },
                  ]}
                />
              </div>
              <div className="remote-setting-item">
                <span>{t('deviceWorkspace.remoteDesktop.encoding')}</span>
                <Select
                  size="small"
                  value={settings.imageFormat}
                  style={{ width: 110 }}
                  onChange={(imageFormat: WorkspaceSettingsValue['imageFormat']) =>
                    onSettingsChange({ ...settings, imageFormat, preset: 'custom' })
                  }
                  options={[
                    { value: 'webp', label: 'WebP' },
                    { value: 'jpeg', label: 'JPEG' },
                    { value: 'png', label: 'PNG' },
                  ]}
                />
              </div>
              <div className="remote-setting-item">
                <span>{t('deviceWorkspace.remoteDesktop.requestInterval')}</span>
                <Select
                  size="small"
                  value={settings.frameTimer}
                  style={{ width: 110 }}
                  onChange={(frameTimer: number) => onSettingsChange({ ...settings, frameTimer, preset: 'custom' })}
                  options={[
                    { value: 17, label: '17 ms' },
                    { value: 33, label: '33 ms' },
                    { value: 50, label: '50 ms' },
                    { value: 100, label: '100 ms' },
                  ]}
                />
              </div>
              <div className="remote-slider-group">
                <div className="remote-slider-label">
                  <span>{t('deviceWorkspace.remoteDesktop.quality')}</span>
                  <span style={{ color: '#8da4be', fontSize: 11 }}>{settings.quality}%</span>
                </div>
                <Slider
                  min={10}
                  max={100}
                  value={settings.quality}
                  onChange={(val) => onSettingsChange({ ...settings, quality: val, preset: 'custom' })}
                />
              </div>
            </div>
          </div>

          {/* 5. 常用工具（剪贴板、截图） */}
          <div className="remote-toolbar-card">
            <div className="remote-toolbar-card-header">{t('deviceWorkspace.remoteDesktop.actionsCardTitle')}</div>
            <div className="remote-shortcuts-grid">
              <Button
                size="small"
                icon={<SnippetsOutlined />}
                disabled={!desktopSession || !meshCentralClient || !inputAllowed}
                onClick={() => void pasteLocalClipboardToRemote()}
              >
                {t('deviceWorkspace.remoteDesktop.pasteRemote')}
              </Button>
              <Button
                size="small"
                icon={<CopyOutlined />}
                disabled={!desktopSession || !meshCentralClient}
                onClick={() => void copyRemoteClipboardToLocal()}
              >
                {t('deviceWorkspace.remoteDesktop.copyLocal')}
              </Button>
              <Button
                size="small"
                icon={<CameraOutlined />}
                disabled={!screen}
                onClick={saveScreenshot}
                style={{ gridColumn: 'span 2' }}
              >
                {t('deviceWorkspace.remoteDesktop.screenshot')}
              </Button>
            </div>
          </div>

          <details className="remote-toolbar-card remote-performance">
            <summary>{t('deviceWorkspace.remoteDesktop.performance')}</summary>
            <Button size="small" disabled={!performanceStats} onClick={exportPerformance}>{t('deviceWorkspace.remoteDesktop.exportPerformance')}</Button>
            <dl>
              <dt>{t('deviceWorkspace.remoteDesktop.actualTransport')}</dt><dd>{desktopSession ? (transport === 'webrtc' ? 'WebRTC DataChannel' : 'WS Relay') : '—'}</dd>
              <dt>{t('deviceWorkspace.remoteDesktop.rtcState')}</dt><dd>{performanceStats?.webrtc ? t('deviceWorkspace.remoteDesktop.rtcStates.' + performanceStats.webrtc) : '—'}</dd>
              <dt>RTT</dt><dd>{currentLatency === undefined ? '—' : currentLatency + ' ms'}</dd>
              <dt>{t('deviceWorkspace.remoteDesktop.received')}</dt><dd>{performanceStats?.relay.receivedBytes ?? 0} B / {Math.round(performanceStats?.bytesPerSecond ?? 0)} B/s</dd>
              <dt>{t('deviceWorkspace.remoteDesktop.tiles')}</dt><dd>{performanceStats?.relay.receivedTiles ?? 0}</dd>
              <dt>{t('deviceWorkspace.remoteDesktop.protocolPending')}</dt><dd>{performanceStats?.relay.pendingProtocolBytes ?? 0} B</dd>
              <dt>{t('deviceWorkspace.remoteDesktop.renderPending')}</dt><dd>{performanceStats?.render?.pendingTiles ?? 0} / {performanceStats?.render?.pendingBytes ?? 0} B</dd>
              <dt>{t('deviceWorkspace.remoteDesktop.drawBatches')}</dt><dd>{performanceStats?.render?.drawBatches ?? 0}</dd>
              <dt>{t('deviceWorkspace.remoteDesktop.decodeMean')}</dt><dd>{((performanceStats?.render?.decodeMs ?? 0) / Math.max(1, performanceStats?.render?.decodedTiles ?? 0)).toFixed(1)} ms</dd>
              <dt>{t('deviceWorkspace.remoteDesktop.waitMean')}</dt><dd>{((performanceStats?.render?.waitMs ?? 0) / Math.max(1, performanceStats?.render?.drawnTiles ?? 0)).toFixed(1)} ms</dd>
              <dt>{t('deviceWorkspace.remoteDesktop.waitP95')}</dt><dd>{(performanceStats?.render?.waitP95Ms ?? 0).toFixed(1)} ms</dd>
            </dl>
          </details>
          {/* 6. 底部常驻全屏操作 */}
          <div className="remote-footer-actions">
            <Button
              size="middle"
              icon={fullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
              onClick={() => void toggleFullscreen()}
              disabled={!screen && !fullscreen}
            >
              {fullscreen ? t('deviceWorkspace.remoteDesktop.exitFullscreen') : t('deviceWorkspace.remoteDesktop.fullscreen')}
            </Button>
          </div>

          {error && (
            <div className="remote-desktop-error">
              <Alert
                type="error"
                showIcon
                closable
                onClose={() => setError(undefined)}
                title={error}
                action={<Button size="small" onClick={() => void connect()}>{t('common.actions.retry')}</Button>}
              />
            </div>
          )}
        </aside>

        <div className="remote-screen-shell">
          <div className="remote-screen" data-scale={scale} ref={screenContainerRef}>
            <DesktopCanvas
              ref={canvasRef}
              scale={scale}
              session={desktopSession}
              keyboardEnabled={settings.keyboard && desktopAccess !== 'denied' && desktopAccess !== 'view-only'}
              mouseEnabled={settings.mouse && desktopAccess !== 'denied' && desktopAccess !== 'view-only'}
              onReady={() => setStatus('connected')}
              onDecodeError={(decodeError) => { disconnect(); setError(decodeError.message); setStatus('error'); }}
              onOverflow={() => { disconnect('Desktop render queue overflow.'); setError(t('deviceWorkspace.remoteDesktop.renderOverflow')); setStatus('error'); }}
            />
            {!screen && (
              <div className="remote-empty">
                <div className="remote-empty-backdrop" />
                <div className="remote-empty-card">
                  <div className="remote-empty-icon-halo">
                    {isConnecting ? (
                      <LoadingOutlined style={{ fontSize: 32, color: '#62a7ff' }} />
                    ) : (
                      <DesktopOutlined />
                    )}
                  </div>
                  <div className="remote-empty-title">
                    {isConnecting
                      ? t('deviceWorkspace.remoteDesktop.connecting')
                      : unavailable
                        ? t('deviceWorkspace.remoteDesktop.unavailable')
                        : model.hostname}
                  </div>
                  <div className="remote-empty-description">
                    {unavailable
                      ? t('deviceWorkspace.remoteDesktop.unavailable')
                      : isConnecting
                        ? t('deviceWorkspace.remoteDesktop.establishing')
                        : t('deviceWorkspace.remoteDesktop.connectToView')}
                  </div>
                  {!isConnecting && !unavailable && (
                    <Button
                      type="primary"
                      className="remote-empty-btn"
                      icon={<PlayCircleOutlined />}
                      onClick={() => void connect()}
                    >
                      {t('deviceWorkspace.remoteDesktop.connect')}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
      <Modal
        title={t('deviceWorkspace.remoteDesktop.pasteTitle')}
        open={pasteModalOpen}
        getContainer={getPopupContainer}
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
