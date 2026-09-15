import type { SessionEvent } from './types';

export const workspaceEvents: SessionEvent[] = [
  { id: 'connected', time: '14:32:21', message: '建立远程桌面连接' },
  { id: 'desktop-ready', time: '14:32:22', message: '认证成功，开始传输桌面' },
  { id: 'latency', time: '14:32:25', message: '连接质量良好，延迟 28 ms' },
  { id: 'input', time: '14:32:30', message: '用户输入已启用' },
];
