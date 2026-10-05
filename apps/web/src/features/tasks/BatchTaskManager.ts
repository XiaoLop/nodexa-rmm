import type { BatchTask, BatchTaskAction, BatchTaskSnapshot, NewBatchTask } from './types';
import { isActiveBatchTaskStatus } from './types';

type Listener = () => void;
type TaskCleanup = () => void;
type DisconnectHandler = () => void;

interface TaskRuntime {
  cleanups: Set<TaskCleanup>;
  disconnectHandlers: Set<DisconnectHandler>;
  actions: Map<BatchTaskAction, () => void>;
}

const MAX_COMPLETED_TASKS = 50;

function createTaskId(): string {
  return `task-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export class BatchTaskManager {
  private snapshot: BatchTaskSnapshot = {
    tasks: [],
    activeCount: 0,
    unviewedCompletedCount: 0,
  };
  private readonly listeners = new Set<Listener>();
  private readonly runtimes = new Map<string, TaskRuntime>();

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): BatchTaskSnapshot => this.snapshot;

  addTask(task: NewBatchTask): string {
    const id = task.id ?? createTaskId();
    const nextTask = { ...task, id, viewed: task.viewed ?? false } as BatchTask;
    this.runtimes.set(id, {
      cleanups: new Set(),
      disconnectHandlers: new Set(),
      actions: new Map(),
    });
    this.publish([nextTask, ...this.snapshot.tasks]);
    return id;
  }

  updateTask(taskId: string, updater: (task: BatchTask) => BatchTask): void {
    let changed = false;
    const tasks = this.snapshot.tasks.map((task) => {
      if (task.id !== taskId) return task;
      changed = true;
      return updater(task);
    });
    if (changed) this.publish(tasks);
  }

  registerCleanup(taskId: string, cleanup: TaskCleanup): () => void {
    const runtime = this.runtimes.get(taskId);
    if (!runtime) return () => undefined;
    runtime.cleanups.add(cleanup);
    return () => runtime.cleanups.delete(cleanup);
  }

  registerDisconnectHandler(taskId: string, handler: DisconnectHandler): () => void {
    const runtime = this.runtimes.get(taskId);
    if (!runtime) return () => undefined;
    runtime.disconnectHandlers.add(handler);
    return () => runtime.disconnectHandlers.delete(handler);
  }

  registerAction(taskId: string, action: BatchTaskAction, handler: () => void): () => void {
    const runtime = this.runtimes.get(taskId);
    if (!runtime) return () => undefined;
    runtime.actions.set(action, handler);
    return () => runtime.actions.delete(action);
  }

  runAction(taskId: string, action: BatchTaskAction): void {
    this.runtimes.get(taskId)?.actions.get(action)?.();
  }

  handleGatewayDisconnected(): void {
    for (const runtime of this.runtimes.values()) {
      for (const handler of runtime.disconnectHandlers) handler();
    }
  }

  markViewed(taskId: string): void {
    this.updateTask(taskId, (task) => (task.viewed ? task : { ...task, viewed: true }));
  }

  removeTask(taskId: string): void {
    const task = this.snapshot.tasks.find((candidate) => candidate.id === taskId);
    if (!task || isActiveBatchTaskStatus(task.status)) return;
    this.disposeRuntime(taskId);
    this.publish(this.snapshot.tasks.filter((candidate) => candidate.id !== taskId));
  }

  clearCompleted(): void {
    const removable = this.snapshot.tasks.filter((task) => !isActiveBatchTaskStatus(task.status));
    for (const task of removable) this.disposeRuntime(task.id);
    this.publish(this.snapshot.tasks.filter((task) => isActiveBatchTaskStatus(task.status)));
  }

  reset(): void {
    for (const taskId of this.runtimes.keys()) this.disposeRuntime(taskId);
    this.publish([]);
  }

  dispose(): void {
    this.reset();
    this.listeners.clear();
  }

  private disposeRuntime(taskId: string): void {
    const runtime = this.runtimes.get(taskId);
    if (!runtime) return;
    for (const cleanup of runtime.cleanups) cleanup();
    runtime.cleanups.clear();
    runtime.disconnectHandlers.clear();
    runtime.actions.clear();
    this.runtimes.delete(taskId);
  }

  private publish(tasks: BatchTask[]): void {
    const activeTasks = tasks.filter((task) => isActiveBatchTaskStatus(task.status));
    const completedTasks = tasks.filter((task) => !isActiveBatchTaskStatus(task.status));
    const retainedCompleted = completedTasks.slice(0, MAX_COMPLETED_TASKS);
    const retainedIds = new Set([...activeTasks, ...retainedCompleted].map((task) => task.id));
    for (const task of completedTasks.slice(MAX_COMPLETED_TASKS)) {
      this.disposeRuntime(task.id);
    }
    const retainedTasks = tasks.filter((task) => retainedIds.has(task.id));
    this.snapshot = {
      tasks: retainedTasks,
      activeCount: activeTasks.length,
      unviewedCompletedCount: retainedCompleted.filter((task) => !task.viewed).length,
    };
    for (const listener of this.listeners) listener();
  }
}
