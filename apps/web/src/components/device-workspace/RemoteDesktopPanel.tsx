import { CameraOutlined, DisconnectOutlined, FullscreenOutlined } from '@ant-design/icons';
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
import { Alert, Button, Select, Space, Tag } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { GATEWAY_RELAY_URL } from '../../config/gateway';
import type { DeviceWorkspaceModel } from '../../features/device-workspace/types';
import { DesktopCanvas, type DesktopCanvasHandle } from './desktop/DesktopCanvas';

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

type DesktopAccess = 'denied' | 'view-only' | 'control';

interface RemoteDesktopPanelProps {
  model: DeviceWorkspaceModel;
  device: Device;
  gatewayClient?: GatewayClient;
  gatewayConnected: boolean;
  desktopAccess?: DesktopAccess;
  scale: string;
  onScaleChange: (value: string) => void;
}

function connectionErrorMessage(error: unknown): string {
  if (error instanceof RelayAgentRouteError) return '设备 Agent 当前无法建立桌面通道，请稍后重试。';
  if (error instanceof RelayCancelledError) return '桌面连接已取消。';
  return error instanceof Error ? error.message : '远程桌面中继连接失败。';
}

export function RemoteDesktopPanel({
  model,
  device,
  gatewayClient,
  gatewayConnected,
  desktopAccess,
  scale,
  onScaleChange,
}: RemoteDesktopPanelProps) {
  const [status, setStatus] = useState<ConnectionState>('idle');
  const [error, setError] = useState<string>();
  const [screen, setScreen] = useState<{ width: number; height: number }>();
  const [recorded, setRecorded] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<DesktopCanvasHandle>(null);
  const sessionRef = useRef<DesktopSession | undefined>(undefined);
  const abortRef = useRef<AbortController | undefined>(undefined);

  const disconnect = (reason = 'Desktop session closed.') => {
    abortRef.current?.abort();
    abortRef.current = undefined;
    sessionRef.current?.close(1000, reason);
    sessionRef.current = undefined;
    canvasRef.current?.clear();
    setScreen(undefined);
    setStatus((current) => (current === 'idle' ? current : 'closed'));
  };

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

      const session = new DesktopSession(relay, { inputAllowed: desktopAccess === 'control' });
      sessionRef.current = session;
      setStatus('waiting-screen');
      session.onScreenSize((nextScreen) => {
        setScreen(nextScreen);
        canvasRef.current?.setScreen(nextScreen);
      });
      session.onTile((nextTile) => canvasRef.current?.drawTile(nextTile));
      session.onStateChange((next: DesktopSessionState) => {
        if (next === 'screen-known') setStatus('waiting-screen');
        if (next === 'desktop-ready') setStatus('connected');
        if (next === 'closed' || next === 'error') setStatus(next);
      });
      session.onError((next) => {
        setError(next.message);
        setStatus('error');
      });
    } catch (connectionError) {
      if (!controller.signal.aborted) {
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

  const unavailable = !device.online || !gatewayConnected || desktopAccess === 'denied';
  const canDisconnect = Boolean(sessionRef.current) || CONNECTING_STATES.has(status);

  return (
    <div className="workspace-center-column">
      <section className="console-card remote-desktop-card">
        <div className="remote-toolbar">
          <Button type="primary" size="small" icon={<FullscreenOutlined />} onClick={() => void toggleFullscreen()} disabled={!screen}>
            全屏
          </Button>
          <Button size="small" icon={<CameraOutlined />} onClick={saveScreenshot} disabled={!screen}>
            截图
          </Button>
          <Button size="small" icon={<DisconnectOutlined />} onClick={() => disconnect()} disabled={!canDisconnect}>
            结束会话
          </Button>
          <Space size={6}>
            <Button type="primary" size="small" onClick={() => void connect()} disabled={unavailable || CONNECTING_STATES.has(status) || status === 'connected'}>
              {CONNECTING_STATES.has(status) ? '连接中' : '连接桌面'}
            </Button>
            {desktopAccess === 'view-only' && <Tag color="gold">只读</Tag>}
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
        <div className="remote-screen-shell" ref={shellRef}>
          <div className="remote-screen" data-scale={scale}>
            <DesktopCanvas
              ref={canvasRef}
              scale={scale}
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
}
