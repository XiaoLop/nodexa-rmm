import { useStore } from 'zustand';
import type { MeshCentralControlStore } from './store';
import type { MeshCentralControlState } from './types';

export function useMeshCentralControlStore<T>(store: MeshCentralControlStore, selector: (state: MeshCentralControlState) => T): T {
  return useStore(store, selector);
}
