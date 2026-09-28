import type { MeshCentralPlugin } from '../types/meshcentral.types.js';

export type PluginHookName = Exclude<keyof MeshCentralPlugin, 'exports'>;

const pluginOptions = new WeakMap<object, { exports: string[] }>();
const pluginHooks = new WeakMap<object, PluginHookName>();

export function MeshPlugin(options: { exports?: string[] } = {}) {
  return (target: abstract new (...args: never[]) => object): void => {
    pluginOptions.set(target, { exports: options.exports ?? [] });
  };
}

export function PluginHook(hookName: PluginHookName) {
  return (
    _target: object,
    _propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ): void => {
    if (typeof descriptor.value === 'function') {
      pluginHooks.set(descriptor.value, hookName);
    }
  };
}

export function getPluginOptions(
  PluginClass: abstract new (...args: never[]) => object,
): { exports: string[] } | undefined {
  return pluginOptions.get(PluginClass);
}

export function getPluginHook(method: object): PluginHookName | undefined {
  return pluginHooks.get(method);
}