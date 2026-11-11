import { DesktopWebRtcSignaler } from './DesktopWebRtcSignaler';
import { describe, expect, it, vi } from 'vitest';
import { RelayConnection } from '../../RelayConnection';
import { RelaySession } from '../../RelaySession';
import { FakeRelayWebSocket } from '../../testing';
import { DesktopSession } from './DesktopSession';
import { DESKTOP_CONTROL_CHANNEL } from './controlMessages';

class FakeRTCDataChannel {
  binaryType = 'arraybuffer';
  readyState: 'connecting' | 'open' | 'closing' | 'closed' = 'connecting';
  sent: Array<string | ArrayBuffer | Uint8Array> = [];
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;

  send(data: string | ArrayBuffer | Uint8Array) {
    this.sent.push(data);
  }

  open() {
    this.readyState = 'open';
    this.onopen?.();
  }

  close() {
    this.readyState = 'closed';
    this.onclose?.();
  }

  receiveMessage(data: string | ArrayBuffer | Uint8Array) {
    this.onmessage?.({ data } as MessageEvent);
  }
}

class FakeRTCPeerConnection {
  dataChannel?: FakeRTCDataChannel;
  iceConnectionState: RTCIceConnectionState = 'new';
  onicecandidate: ((e: RTCPeerConnectionIceEvent) => void) | null = null;
  oniceconnectionstatechange: (() => void) | null = null;
  localDescription: RTCSessionDescriptionInit | null = null;
  remoteDescription: RTCSessionDescriptionInit | null = null;

  createDataChannel() {
    const dc = new FakeRTCDataChannel();
    this.dataChannel = dc;
    return dc as unknown as RTCDataChannel;
  }

  async createOffer() {
    return { type: 'offer' as const, sdp: 'v=0\r\no=mock\r\n' };
  }

  async setLocalDescription(desc: RTCSessionDescriptionInit) {
    this.localDescription = desc;
  }

  async setRemoteDescription(desc: RTCSessionDescriptionInit) {
    this.remoteDescription = desc;
  }

  close() {
    this.iceConnectionState = 'closed';
    this.oniceconnectionstatechange?.();
  }
}

describe('DesktopSession WebRTC integration', () => {
  it('performs WebRTC handshake and switches transport to webrtc upon webrtc0', async () => {
    let createdPc: FakeRTCPeerConnection | undefined;
    const peerConnectionFactory = () => {
      createdPc = new FakeRTCPeerConnection();
      return createdPc as unknown as RTCPeerConnection;
    };

    const socket = new FakeRelayWebSocket();
    const connection = new RelayConnection({
      baseUrl: 'wss://mesh.example.com',
      deviceId: 'node//one',
      protocol: 2,
      relayId: 'relay-id',
      authCookie: 'cookie',
      webSocketFactory: () => socket,
    });
    const connecting = connection.connect();
    socket.open();
    socket.message('c');
    await connecting;
    socket.sent.length = 0;
    const relay = new RelaySession({ id: 'relay-id', deviceId: 'node//one', protocol: 2, connection });

    const transports: string[] = [];

    const session = new DesktopSession(relay, {
      inputAllowed: true,
      rttIntervalMs: 0,
      webrtc: {
        peerConnectionFactory,
      },
    });

    session.onTransportChange((t) => transports.push(t));

    expect(createdPc).toBeDefined();
    const pc = createdPc!;
    expect(pc.dataChannel).toBeDefined();
    const dc = pc.dataChannel!;

    // 等待 createOffer promise 完成
    await Promise.resolve();
    await Promise.resolve();

    // 触发 ice 候选结束
    pc.onicecandidate?.({ candidate: null } as unknown as RTCPeerConnectionIceEvent);

    // 验证 relay 发送了 offer
    const offerMsg = socket.sent.find((t) => typeof t === 'string' && t.includes('"type":"offer"'));
    expect(offerMsg).toBeDefined();

    // 模拟对端返回 answer
    socket.message(JSON.stringify({ type: 'answer', sdp: 'v=0\r\no=mock-answer\r\n' }));
    await vi.waitFor(() => {
      expect(pc.remoteDescription?.type).toBe('answer');
    });

    // 模拟对端发送 webrtc0
    socket.message(JSON.stringify({ ctrlChannel: DESKTOP_CONTROL_CHANNEL, type: 'webrtc0' }));
    await vi.waitFor(() => {
      expect(socket.sent.length).toBeGreaterThan(0);
    });

    // 本地 DataChannel 变为 open
    dc.open();

    // 切换完成
    expect(session.transport).toBe('webrtc');
    expect(transports).toContain('webrtc');

    // 确认发送了 webrtc0 和 webrtc1 切换信令
    expect(socket.sent.some((t) => typeof t === 'string' && t.includes('"type":"webrtc0"'))).toBe(true);
    expect(socket.sent.some((t) => typeof t === 'string' && t.includes('"type":"webrtc1"'))).toBe(true);

    // 测试输入发送走 DataChannel 而非 WebSocket
    session.sendMouseMove({ x: 100, y: 200 });
    expect(dc.sent.length).toBeGreaterThan(0);

    // 模拟对端通过 webrtc1，验证本地回复 webrtc2
    socket.message(JSON.stringify({ ctrlChannel: DESKTOP_CONTROL_CHANNEL, type: 'webrtc1' }));
    await vi.waitFor(() => {
      expect(socket.sent.some((t) => typeof t === 'string' && t.includes('"type":"webrtc2"'))).toBe(true);
    });

    // 模拟 DataChannel 接收到二进制瓦片包或指令，验证解析正常
    const tileBytes = new Uint8Array([
      0, 7, // cmd 7 屏幕尺寸
      0, 8, // size 8
      0x04, 0x00, // width 1024
      0x03, 0x00, // height 768
    ]);
    const screens: Array<{ width: number; height: number }> = [];
    session.onScreenSize((s) => screens.push(s));

    dc.receiveMessage(tileBytes.buffer);
    await vi.waitFor(() => {
      expect(screens.length).toBe(1);
      expect(screens[0]).toEqual({ width: 1024, height: 768 });
    });

    // 模拟 DataChannel 关闭，回退到 websocket
    dc.close();
    expect(session.transport).toBe('websocket');
    expect(transports.at(-1)).toBe('websocket');
    expect(session.webrtcState).toBe('closed');
    expect(pc.iceConnectionState).toBe('closed');
    session.close();
  });
});

describe('DesktopWebRtcSignaler lifecycle', () => {
  it('closes the peer and data channel on disposal during negotiation', async () => {
    const pc = new FakeRTCPeerConnection();
    const signaler = new DesktopWebRtcSignaler({ peerConnectionFactory: () => pc as unknown as RTCPeerConnection }, {
      stateChange: vi.fn(), sendSignal: vi.fn(), message: vi.fn(), switched: vi.fn(), fallback: vi.fn(),
    });
    signaler.start();
    await vi.waitFor(() => expect(pc.localDescription).not.toBeNull());
    signaler.dispose();
    expect(pc.dataChannel?.readyState).toBe('closed');
    expect(pc.iceConnectionState).toBe('closed');
    expect(signaler.state).toBe('closed');
  });
});
