import type { RelayProtocol } from '../types';

export const RELAY_PROTOCOLS = {
  terminal: 1,
  desktop: 2,
  files: 5,
  webSsh: 11,
  webSshFiles: 13,
} as const satisfies Record<string, RelayProtocol>;

export type BuiltInRelayProtocol = (typeof RELAY_PROTOCOLS)[keyof typeof RELAY_PROTOCOLS];

export interface RelayProtocolDescriptor {
  protocol: RelayProtocol;
  name: string;
}
