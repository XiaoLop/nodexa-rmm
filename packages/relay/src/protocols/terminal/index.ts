import { RELAY_PROTOCOLS, type RelayProtocolDescriptor } from '../types';

export {
  TERMINAL_CONTROL_CHANNEL,
  createTerminalOptionsMessage,
  createTerminalResizeMessage,
  createTerminalRttMessage,
  parseTerminalControlMessage,
} from './controlMessages';
export { TerminalSession } from './TerminalSession';
export {
  TerminalSessionError,
  type TerminalControlMessage,
  type TerminalControlMessageType,
  type TerminalSessionErrorCode,
  type TerminalSessionOptions,
  type TerminalSessionState,
  type TerminalSize,
} from './types';

export const terminalRelayProtocol: RelayProtocolDescriptor = {
  protocol: RELAY_PROTOCOLS.terminal,
  name: 'terminal',
};
