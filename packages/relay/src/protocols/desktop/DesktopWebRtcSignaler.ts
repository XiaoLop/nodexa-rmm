import type { DesktopWebRtcOptions, DesktopWebRtcState } from './types';
import { createWebRtcSwitchMessage } from './controlMessages';

export interface DesktopWebRtcSignalerEvents {
  stateChange: (state: DesktopWebRtcState) => void;
  sendSignal: (text: string) => void;
  message: (data: string | ArrayBuffer) => void;
  switched: () => void;
  fallback: () => void;
}

export class DesktopWebRtcSignaler {
  private pc?: RTCPeerConnection;
  private dataChannel?: RTCDataChannel;
  private stateValue: DesktopWebRtcState = 'idle';
  private webSwitchOk = false;
  private active = false;
  private disposed = false;

  constructor(
    private readonly options: DesktopWebRtcOptions = {},
    private readonly events: DesktopWebRtcSignalerEvents,
  ) {}

  get state(): DesktopWebRtcState {
    return this.stateValue;
  }

  get isActive(): boolean {
    return this.active;
  }

  get isSwitched(): boolean {
    return this.active && this.dataChannel?.readyState === 'open';
  }

  start(): void {
    if (this.disposed || this.stateValue !== 'idle') return;
    if (this.options.enabled === false) return;

    const factory =
      this.options.peerConnectionFactory ??
      (typeof RTCPeerConnection !== 'undefined'
        ? (cfg?: RTCConfiguration) => new RTCPeerConnection(cfg)
        : undefined);

    if (!factory) {
      this.transition('failed');
      return;
    }

    try {
      this.transition('offering');
      const rtcConfig = this.options.rtcConfig ?? {
        iceServers: [
          { urls: 'stun:stun.cloudflare.com:3478' },
          { urls: 'stun:stun.l.google.com:19302' },
        ],
      };
      const pc = factory(rtcConfig);
      this.pc = pc;

      // 1. 创建 DataChannel，必须命名为 'DataChannel'，且使用 arraybuffer
      const dc = pc.createDataChannel('DataChannel', {});
      dc.binaryType = 'arraybuffer';
      this.dataChannel = dc;

      dc.onopen = () => {
        if (this.disposed) return;
        this.trySwitchTraffic();
      };

      dc.onclose = () => {
        if (this.disposed) return;
        this.active = false;
        this.events.fallback();
      };

      dc.onerror = () => {
        if (this.disposed) return;
        this.close();
      };

      dc.onmessage = (event: MessageEvent) => {
        if (this.disposed) return;
        this.events.message(event.data);
      };

      // 2. 收集候选并在完成后将整个 SDP Offer 通过 WSS 发送
      let currentOffer: RTCSessionDescriptionInit | null = null;
      pc.onicecandidate = (e: RTCPeerConnectionIceEvent) => {
        if (this.disposed) return;
        if (e.candidate == null) {
          // 所有候选收集完毕
          if (currentOffer) {
            this.transition('connecting');
            this.events.sendSignal(JSON.stringify(currentOffer));
          }
        } else if (currentOffer && e.candidate.candidate) {
          currentOffer.sdp = (currentOffer.sdp || '') + 'a=' + e.candidate.candidate + '\r\n';
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (this.disposed) return;
        if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
          this.close();
        }
      };

      pc.createOffer({
        mandatory: { OfferToReceiveAudio: false, OfferToReceiveVideo: false },
      } as unknown as RTCOfferOptions)
        .then((offer) => {
          if (this.disposed) return;
          currentOffer = { type: offer.type, sdp: offer.sdp };
          return pc.setLocalDescription(offer);
        })
        .catch(() => {
          if (this.disposed) return;
          this.close();
        });
    } catch {
      this.close();
    }
  }

  handleControlMessage(msg: Record<string, unknown>): boolean {
    if (this.disposed) return false;

    // 收到 Agent 回复的 Answer
    if (msg.type === 'answer' && typeof msg.sdp === 'string' && this.pc) {
      const desc = { type: 'answer' as const, sdp: msg.sdp };
      this.pc
        .setRemoteDescription(desc)
        .catch(() => {
          this.close();
        });
      return true;
    }

    // 收到 webrtc0
    if (msg.type === 'webrtc0') {
      this.webSwitchOk = true;
      this.trySwitchTraffic();
      return true;
    }

    // 收到 webrtc1
    if (msg.type === 'webrtc1') {
      this.events.sendSignal(JSON.stringify(createWebRtcSwitchMessage('webrtc2')));
      return true;
    }

    return false;
  }

  send(data: Uint8Array): boolean {
    if (this.active && this.dataChannel?.readyState === 'open') {
      const buffer =
        data.byteOffset === 0 && data.byteLength === data.buffer.byteLength && data.buffer instanceof ArrayBuffer
          ? (data.buffer as ArrayBuffer)
          : (data.slice().buffer as ArrayBuffer);
      this.dataChannel.send(buffer);
      return true;
    }
    return false;
  }

  close(): void {
    if (this.stateValue === 'closed' || this.disposed) return;
    const wasActive = this.active;
    this.active = false;
    this.webSwitchOk = false;
    if (this.dataChannel) {
      try {
        this.dataChannel.close();
      } catch {
        // Ignore errors while closing an already-invalid data channel.
      }
      this.dataChannel = undefined;
    }
    if (this.pc) {
      try {
        this.pc.close();
      } catch {
        // Ignore errors while closing an already-invalid peer connection.
      }
      this.pc = undefined;
    }
    this.transition('closed');
    if (wasActive) {
      this.events.fallback();
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.close();
  }

  private trySwitchTraffic(): void {
    if (this.webSwitchOk && this.dataChannel?.readyState === 'open' && !this.active) {
      this.active = true;
      this.transition('switching');
      // 发送 webrtc0 和 webrtc1 告知 Agent 可以切换且 WSS 上的数据结束
      this.events.sendSignal(JSON.stringify(createWebRtcSwitchMessage('webrtc0')));
      this.events.sendSignal(JSON.stringify(createWebRtcSwitchMessage('webrtc1')));
      this.transition('connected');
      this.events.switched();
    }
  }

  private transition(state: DesktopWebRtcState): void {
    if (this.stateValue === state) return;
    this.stateValue = state;
    this.events.stateChange(state);
  }
}
