import { useEffect, useRef } from 'react';
import { BatchUploadManager } from '../batch-upload/BatchUploadManager';

export function useBatchUploadManager(connected: boolean): BatchUploadManager {
  const managerRef = useRef<BatchUploadManager | null>(null);
  if (!managerRef.current) managerRef.current = new BatchUploadManager();
  const manager = managerRef.current;

  useEffect(() => {
    // React StrictMode 在开发环境会执行一次 setup → cleanup → setup。
    // 重新激活管理器，避免第一次 cleanup 后调度器永久处于 disposed 状态。
    manager.activate();
    return () => manager.dispose();
  }, [manager]);

  useEffect(() => {
    if (!connected) manager.handleGatewayDisconnected();
  }, [connected, manager]);

  return manager;
}
