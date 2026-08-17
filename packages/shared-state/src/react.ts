import { useStore } from 'zustand';
import type { GatewayStore } from './store';
import type { GatewayState } from './types';

export function useGatewayStore<T>(store: GatewayStore, selector: (state: GatewayState) => T): T {
  return useStore(store, selector);
}
