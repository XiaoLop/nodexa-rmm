import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseDocument } from 'yaml';

type Config = Record<string, unknown>;

function isObject(value: unknown): value is Config {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function mergeConfig(defaults: Config, overrides: Config): Config {
  const result = { ...defaults };
  for (const [key, value] of Object.entries(overrides)) {
    if (['__proto__', 'constructor', 'prototype'].includes(key)) {
      throw new Error('Unsupported configuration key');
    }
    result[key] = isObject(value)
      ? mergeConfig(isObject(defaults[key]) ? defaults[key] : {}, value)
      : value;
  }
  return result;
}

export function applyDatabaseEnvironment(config: Config, environment: NodeJS.ProcessEnv): Config {
  const keys = ['HOST', 'PORT', 'USERNAME', 'PASSWORD', 'AUTH_SOURCE', 'NAME'];
  if (!keys.some((key) => environment[`MESHCENTRAL_DB_${key}`] !== undefined)) return config;
  const values = Object.fromEntries(
    keys.map((key) => {
      const value = environment[`MESHCENTRAL_DB_${key}`];
      if (!value) throw new Error(`Missing MESHCENTRAL_DB_${key}`);
      return [key, value];
    }),
  );
  if (!/^[a-zA-Z0-9.-]+$/.test(values.HOST!)) throw new Error('Invalid MESHCENTRAL_DB_HOST');
  if (!/^\d+$/.test(values.PORT!) || Number(values.PORT) < 1 || Number(values.PORT) > 65535) {
    throw new Error('Invalid MESHCENTRAL_DB_PORT');
  }
  if (![values.NAME, values.AUTH_SOURCE].every((value) => /^[a-zA-Z0-9_-]+$/.test(value!))) {
    throw new Error('Invalid database name or authentication source');
  }
  const settings = isObject(config.settings) ? config.settings : {};
  if (settings.mongoDbName !== undefined && settings.mongoDbName !== values.NAME) {
    throw new Error('settings.mongoDbName must match MESHCENTRAL_DB_NAME');
  }
  const username = encodeURIComponent(values.USERNAME!);
  const password = encodeURIComponent(values.PASSWORD!);
  return {
    ...config,
    settings: {
      ...settings,
      mongoDbName: values.NAME,
      mongoDb: `mongodb://${username}:${password}@${values.HOST}:${values.PORT}/${values.NAME}?authSource=${values.AUTH_SOURCE}`,
    },
  };
}

export function loadConfig(
  defaultPath: string,
  yamlPath: string,
  environment: NodeJS.ProcessEnv = process.env,
): Config {
  const defaults: unknown = JSON.parse(readFileSync(defaultPath, 'utf8'));
  const document = parseDocument(readFileSync(yamlPath, 'utf8'));
  if (document.errors.length > 0) {
    throw new Error('Invalid YAML configuration');
  }
  const overrides: unknown = document.toJS({ maxAliasCount: 100 });
  if (!isObject(defaults) || (overrides !== null && !isObject(overrides))) {
    throw new Error('Configuration must be an object');
  }
  const config = mergeConfig(defaults, overrides ?? {});
  for (const key of ['settings', 'domains']) {
    if (key in config && !isObject(config[key])) {
      throw new Error(`Configuration ${key} must be an object`);
    }
  }
  return applyDatabaseEnvironment(config, environment);
}

export function prepareConfig(args: string[], defaultPath: string) {
  const forwarded: string[] = [];
  const inputs: { option: string; path: string }[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]!;
    const match = /^(--config-yaml|--configfile)(?:=(.*))?$/.exec(argument);
    if (!match) {
      forwarded.push(argument);
      continue;
    }
    const path = match[2] ?? args[++index];
    if (!path || path.startsWith('--')) {
      throw new Error('Configuration argument requires a path');
    }
    inputs.push({ option: match[1]!, path });
  }
  if (inputs.length > 1) {
    throw new Error('Specify only one configuration file');
  }
  const input = inputs[0];
  if (!input || (input.option === '--configfile' && !/\.ya?ml$/i.test(input.path))) {
    return { args, cleanup: () => {} };
  }
  const config = loadConfig(defaultPath, input.path);
  const directory = mkdtempSync(join(tmpdir(), 'meshcentral-config-'));
  const cleanup = () => rmSync(directory, { recursive: true, force: true });
  const output = join(directory, 'config.json');
  try {
    writeFileSync(output, JSON.stringify(config, null, 2), { mode: 0o600 });
  } catch (error) {
    cleanup();
    throw error;
  }
  return { args: [...forwarded, '--configfile', output], cleanup };
}
