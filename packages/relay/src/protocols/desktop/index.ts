import { RELAY_PROTOCOLS, type RelayProtocolDescriptor } from '../types';

export { DesktopProtocolParser } from './DesktopProtocolParser';
export { DesktopSession } from './DesktopSession';
export { DesktopWebRtcSignaler } from './DesktopWebRtcSignaler';
export {
  DESKTOP_CONTROL_CHANNEL,
  createDesktopRttMessage,
  createWebRtcSwitchMessage,
  parseDesktopControlMessage,
} from './controlMessages';
export {
  createCadMessage,
  createCompressionMessage,
  createKeyMessage,
  createMouseButtonMessage,
  createMouseDoubleClickMessage,
  createMouseMoveMessage,
  createMouseWheelMessage,
  createUnicodeMessage,
  detectImageFormat,
  parseDisplayGeometry,
  parseScreenSize,
  parseTile,
} from './commands';
export {
  DesktopSessionError,
  type DesktopCompressionOptions,
  type DesktopControlMessage,
  type DesktopDisplayGeometry,
  type DesktopImageFormat,
  type DesktopKeyPhase,
  type DesktopMetadataMessage,
  type DesktopRttMessage,
  type DesktopWebRtcAnswerMessage,
  type DesktopWebRtcSwitchMessage,
  type DesktopTransportType,
  type DesktopWebRtcState,
  type DesktopWebRtcOptions,
  type DesktopMouseButton,
  type DesktopPoint,
  type DesktopProtocolCommand,
  type DesktopScreenSize,
  type DesktopSessionErrorCode,
  type DesktopSessionOptions,
  type DesktopSessionState,
  type DesktopTile,
} from './types';

export const desktopRelayProtocol: RelayProtocolDescriptor = {
  protocol: RELAY_PROTOCOLS.desktop,
  name: 'desktop',
};
