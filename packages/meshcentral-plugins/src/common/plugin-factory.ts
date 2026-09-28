import {
  getPluginHook,
  getPluginOptions,
} from '../decorators/plugin.drcorator.js';
import type {
  MeshCentralPlugin,
  MeshCentralPluginFactory,
  MeshCentralPluginHandler,
} from '../types/meshcentral.types.js';

type PluginInstance = object;
type PluginInstanceFactory = (
  pluginHandler: MeshCentralPluginHandler,
) => PluginInstance;

export function createPluginFactory(
  PluginClass: abstract new (...args: never[]) => PluginInstance,
  createInstance: PluginInstanceFactory,
): MeshCentralPluginFactory {
  const options = getPluginOptions(PluginClass);
  if (options == null) {
    throw new Error(`${PluginClass.name} must be decorated with @MeshPlugin()`);
  }

  console.log(`[${PluginClass.name}] Plugin factory created`);

  return (pluginHandler) => {
    const instance = createInstance(pluginHandler);
    const plugin: MeshCentralPlugin = { exports: [...options.exports] };
    const prototype = Object.getPrototypeOf(instance) as object;

    for (const propertyName of Object.getOwnPropertyNames(prototype)) {
      if (propertyName === 'constructor') continue;
      const method = Reflect.get(prototype, propertyName) as unknown;
      if (typeof method !== 'function') continue;
      const hookName = getPluginHook(method);
      if (hookName == null) continue;
      plugin[hookName] = method.bind(instance);
    }

    return plugin;
  };
}