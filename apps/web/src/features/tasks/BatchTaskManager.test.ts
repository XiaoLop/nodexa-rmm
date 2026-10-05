import { describe, expect, it, vi } from 'vitest';
import { BatchTaskManager } from './BatchTaskManager';

function addPowerTask(manager: BatchTaskManager, status: 'running' | 'completed' = 'running') {
  return manager.addTask({
    kind: 'power',
    title: 'Restart devices',
    status,
    createdAt: Date.now(),
    progress: status === 'completed' ? 100 : 25,
    totalCount: 4,
    completedCount: status === 'completed' ? 4 : 1,
    succeededCount: status === 'completed' ? 4 : 0,
    failedCount: 0,
    skippedCount: 0,
    availableActions: [],
    action: 'reset',
    results: [],
  });
}

describe('BatchTaskManager', () => {
  it('publishes active and unviewed completed counters', () => {
    const manager = new BatchTaskManager();
    addPowerTask(manager, 'running');
    addPowerTask(manager, 'completed');

    expect(manager.getSnapshot()).toMatchObject({
      activeCount: 1,
      unviewedCompletedCount: 1,
    });
  });

  it('keeps subscribers active after a session reset', () => {
    const manager = new BatchTaskManager();
    const listener = vi.fn();
    manager.subscribe(listener);
    addPowerTask(manager);

    manager.reset();
    addPowerTask(manager);

    expect(listener).toHaveBeenCalledTimes(3);
    expect(manager.getSnapshot().activeCount).toBe(1);
  });

  it('does not remove an active task', () => {
    const manager = new BatchTaskManager();
    const taskId = addPowerTask(manager);

    manager.removeTask(taskId);

    expect(manager.getSnapshot().tasks).toHaveLength(1);
  });

  it('runs registered task actions and disposes task resources', () => {
    const manager = new BatchTaskManager();
    const taskId = addPowerTask(manager, 'completed');
    const retry = vi.fn();
    const cleanup = vi.fn();
    manager.registerAction(taskId, 'retry', retry);
    manager.registerCleanup(taskId, cleanup);

    manager.runAction(taskId, 'retry');
    manager.removeTask(taskId);

    expect(retry).toHaveBeenCalledOnce();
    expect(cleanup).toHaveBeenCalledOnce();
    expect(manager.getSnapshot().tasks).toHaveLength(0);
  });
});
