import { CameraOutlined, CompressOutlined, CopyOutlined, DisconnectOutlined, FullscreenExitOutlined, FullscreenOutlined, SnippetsOutlined } from '@ant-design/icons';
import type { GatewayClient } from '@meshcentral/control-client';
import {
  DesktopSession,
  RELAY_PROTOCOLS,
  RelayAgentRouteError,
  RelayCancelledError,
  RelayClient,
  type DesktopSessionState,
} from '@meshcentral/relay';
import type { Device } from '@meshcentral/shared-state';
import { Alert, Button, Modal, Select, Space, Tag, message } from 'antd';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { GATEWAY_RELAY_URL } from '../../config/gateway';
import type { DeviceWorkspaceModel } from '../../features/device-workspace/types';
import { DesktopCanvas, type DesktopCanvasHandle } from './desktop/DesktopCanvas';
import { getRemoteClipboard, setRemoteClipboard } from './desktop/desktopClipboard';

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

const STATUS_LABELS: Record<ConnectionState, string> = {
  idle: '未连接',
  authorizing: '正在申请中继授权',
  notifying: '正在通知设备 Agent',
  connecting: '正在连接中继',
  handshaking: '正在等待桌面配对',
  'waiting-screen': '正在等待桌面画面',
  connected: '已连接',
  closed: '会话已结束',
  error: '连接失败',
};

type DesktopAccess = 'denied' | 'view-only' | 'limited-input' | 'control';

interface RemoteDesktopPanelProps {
  model: DeviceWorkspaceModel;
  device: Device;
  gatewayClient?: GatewayClient;
  gatewayConnected: boolean;
  desktopAccess?: DesktopAccess;
  keyboardEnabled: boolean;
  mouseEnabled: boolean;
  scale: string;
  onScaleChange: (value: string) => void;
  onSessionActiveChange?: (active: boolean) => void;
}

export interface RemoteDesktopPanelHandle {
  disconnect(): void;
}

function connectionErrorMessage(error: unknown): string {
  if (error instanceof RelayAgentRouteError) return '设备 Agent 当前无法建立桌面通道，请稍后重试。';
  if (error instanceof RelayCancelledError) return '桌面连接已取消。';
  return error instanceof Error ? error.message : '远程桌面中继连接失败。';
}

export const RemoteDesktopPanel = forwardRef<RemoteDesktopPanelHandle, RemoteDesktopPanelProps>(function RemoteDesktopPanel({
  model,
  device,
  gatewayClient,
  gatewayConnected,
  desktopAccess,
  keyboardEnabled,
  mouseEnabled,
  scale,
  onScaleChange,
  onSessionActiveChange,
}, ref) {
  const [messageApi, messageContextHolder] = message.useMessage();
  const [status, setStatus] = useState<ConnectionState>('idle');
  const [error, setError] = useState<string>();
  const [screen, setScreen] = useState<{ width: number; height: number }>();
  const [recorded, setRecorded] = useState(false);
  const [desktopSession, setDesktopSession] = useState<DesktopSession>();
  const [fullscreen, setFullscreen] = useState(false);
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
  }, [device.id, gatewayClient]);
  useEffect(() => {
    if (!gatewayConnected && (sessionRef.current || abortRef.current)) {
      disconnect('Gateway connection was lost.');
      setError('网关连接已断开，桌面会话已结束。');
    }
  }, [gatewayConnected]);
  useEffect(() => {
    const handleFullscreenChange = () => setFullscreen(document.fullscreenElement === shellRef.current);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    handleFullscreenChange();
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const connect = async () => {
    if (CONNECTING_STATES.has(status) || status === 'connected') return;
    if (!device.online || !gatewayConnected || !gatewayClient || desktopAccess === 'denied') {
      setError(
        desktopAccess === 'denied'
          ? '当前账户没有远程桌面权限。'
          : !device.online
            ? '设备当前离线，无法建立远程桌面。'
            : '网关控制通道不可用.',
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
      const relay = await new RelayClient({ baseUrl: GATEWAY_RELAY_URL, control: gatewayClient }).createSession({
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
        setError(connectionErrorMessage(connectionError));
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
    if (!gatewayClient || !desktopSession) return;
    try {
      const text = await navigator.clipboard.readText();
      if (!text) {
        void messageApi.info('本地剪贴板为空。');
        return;
      }
      Modal.confirm({
        title: '粘贴本地剪贴板到远端？',
        content: `将向 ${model.hostname} 提交 ${text.length} 个字符。`,
        okText: '粘贴到远端',
        cancelText: '取消',
        onOk: async () => {
          setRemoteClipboard(gatewayClient, device.id, text);
          await new Promise((resolve) => window.setTimeout(resolve, 150));
          if (sessionRef.current !== desktopSession) throw new Error('远程桌面会话已结束。');
          desktopSession.sendKey(17, 'down');
          desktopSession.sendKey(86, 'down');
          desktopSession.sendKey(86, 'up');
          desktopSession.sendKey(17, 'up');
          void messageApi.success('剪贴板内容已提交，并触发远端 Ctrl+V。');
        },
      });
    } catch {
      void messageApi.error('无法读取本地剪贴板，请确认页面使用 HTTPS 且已授予剪贴板权限。');
    }
  };

  const copyRemoteClipboardToLocal = async () => {
    if (!gatewayClient || !desktopSession) return;
    try {
      if (desktopAccess !== 'denied' && desktopAccess !== 'view-only') {
        desktopSession.sendKey(17, 'down');
        desktopSession.sendKey(67, 'down');
        desktopSession.sendKey(67, 'up');
        desktopSession.sendKey(17, 'up');
        await new Promise((resolve) => window.setTimeout(resolve, 200));
      }
      const text = await getRemoteClipboard(gatewayClient, device.id);
      await navigator.clipboard.writeText(text);
      void messageApi.success(`已将远端剪贴板的 ${text.length} 个字符写入本地剪贴板。`);
    } catch (clipboardError) {
      void messageApi.error(clipboardError instanceof Error ? clipboardError.message : '同步远端剪贴板失败。');
    }
  };

  const unavailable = !device.online || !gatewayConnected || desktopAccess === 'denied';
  const canDisconnect = Boolean(sessionRef.current) || CONNECTING_STATES.has(status);

  return (
    <div className="workspace-center-column">
      {messageContextHolder}
      <section className="console-card remote-desktop-card" ref={shellRef}>
        <div className="remote-toolbar">
          <Button type="primary" size="small" icon={fullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />} onClick={() => void toggleFullscreen()} disabled={!screen}>
            {fullscreen ? '退出全屏' : '全屏'}
          </Button>
          <Button size="small" icon={<CameraOutlined />} onClick={saveScreenshot} disabled={!screen}>
            截图
          </Button>
          <Button size="small" icon={<DisconnectOutlined />} onClick={() => disconnect()} disabled={!canDisconnect}>
            结束会话
          </Button>
          <Button size="small" icon={<CompressOutlined />} onClick={() => desktopSession?.sendCad()} disabled={!desktopSession || desktopAccess === 'denied' || desktopAccess === 'view-only'}>
            Ctrl+Alt+Del
          </Button>
          <Button size="small" icon={<SnippetsOutlined />} onClick={() => void pasteLocalClipboardToRemote()} disabled={!desktopSession || !gatewayClient || desktopAccess === 'denied' || desktopAccess === 'view-only'}>
            粘贴到远端
          </Button>
          <Button size="small" icon={<CopyOutlined />} onClick={() => void copyRemoteClipboardToLocal()} disabled={!desktopSession || !gatewayClient}>
            复制到本地
          </Button>
          <Space size={6}>
            <Button type="primary" size="small" onClick={() => void connect()} disabled={unavailable || CONNECTING_STATES.has(status) || status === 'connected'}>
              {CONNECTING_STATES.has(status) ? '连接中' : '连接桌面'}
            </Button>
            {desktopAccess === 'view-only' && <Tag color="gold">只读</Tag>}
            {desktopAccess === 'limited-input' && <Tag color="orange">受限输入</Tag>}
            {desktopAccess === undefined && <Tag>权限待服务端确认</Tag>}
            {recorded && <Tag color="blue">已录制</Tag>}
          </Space>
        </div>
        <div className="remote-status-row">
          <span>
            <i /> {STATUS_LABELS[status]}
            {screen ? ` · ${screen.width} × ${screen.height}` : ''}
            {error ? ` · ${error}` : ''}
          </span>
          <Select
            size="small"
            value={scale}
            onChange={onScaleChange}
            options={[
              { value: 'fit', label: '适应窗口' },
              { value: '100', label: '100%' },
              { value: '75', label: '75%' },
            ]}
          />
        </div>
        {error && <Alert type="error" showIcon message={error} action={<Button size="small" onClick={() => void connect()}>重试</Button>} />}
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
                {unavailable ? '当前不可建立远程桌面会话' : CONNECTING_STATES.has(status) ? '正在建立新的桌面会话' : '连接后显示远程桌面'}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
});
