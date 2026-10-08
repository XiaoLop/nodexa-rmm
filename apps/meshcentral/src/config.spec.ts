import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { applyDatabaseEnvironment, loadConfig, mergeConfig, prepareConfig } from './config';

const directories: string[] = [];

function fixture(yaml: string) {
  const directory = mkdtempSync(join(tmpdir(), 'meshcentral-test-'));
  directories.push(directory);
  const defaults = join(directory, 'default.json');
  const input = join(directory, 'config.yaml');
  writeFileSync(defaults, JSON.stringify({ settings: { port: 443, selfUpdate: false } }));
  writeFileSync(input, yaml);
  return { defaults, input };
}

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('MeshCentral configuration', () => {
  const databaseEnvironment = {
    MESHCENTRAL_DB_HOST: 'mongodb',
    MESHCENTRAL_DB_PORT: '27017',
    MESHCENTRAL_DB_USERNAME: 'app@user',
    MESHCENTRAL_DB_PASSWORD: 'secret:/@# $',
    MESHCENTRAL_DB_AUTH_SOURCE: 'meshcentral',
    MESHCENTRAL_DB_NAME: 'meshcentral',
  };

  it('overrides the URI with encoded credentials without mutating defaults', () => {
    const original = { settings: { mongoDb: 'old', mongoDbName: 'meshcentral', port: 8443 } };
    const result = applyDatabaseEnvironment(original, databaseEnvironment);
    expect(result.settings).toEqual({
      port: 8443,
      mongoDbName: 'meshcentral',
      mongoDb:
        'mongodb://app%40user:secret%3A%2F%40%23%20%24@mongodb:27017/meshcentral?authSource=meshcentral',
    });
    expect(original.settings.mongoDb).toBe('old');
    expect(applyDatabaseEnvironment(original, {})).toBe(original);
  });

  it.each(Object.keys(databaseEnvironment))('rejects a missing database variable %s', (key) => {
    expect(() => applyDatabaseEnvironment({}, { ...databaseEnvironment, [key]: '' })).toThrow(
      `Missing ${key}`,
    );
  });

  it('rejects invalid addresses and inconsistent database names', () => {
    expect(() =>
      applyDatabaseEnvironment({}, { ...databaseEnvironment, MESHCENTRAL_DB_HOST: 'host/evil' }),
    ).toThrow();
    expect(() =>
      applyDatabaseEnvironment({}, { ...databaseEnvironment, MESHCENTRAL_DB_PORT: '65536' }),
    ).toThrow();
    expect(() =>
      applyDatabaseEnvironment({ settings: { mongoDbName: 'other' } }, databaseEnvironment),
    ).toThrow();
  });

  it('applies environment credentials after YAML overrides', () => {
    const { defaults, input } = fixture('settings:\n  mongoDb: old-uri');
    const result = loadConfig(defaults, input, databaseEnvironment);
    expect((result.settings as Record<string, unknown>).mongoDb).toContain('app%40user:secret%3A');
  });

  it('merges nested objects and replaces arrays and explicit values', () => {
    const defaults = {
      domains: { '': { title: 'Default', enabled: true, port: 443, list: [1, 2] } },
    };
    expect(
      mergeConfig(defaults, { domains: { '': { enabled: false, port: 0, list: [], title: '' } } }),
    ).toEqual({ domains: { '': { title: '', enabled: false, port: 0, list: [] } } });
    expect(defaults.domains[''].list).toEqual([1, 2]);
    expect(mergeConfig({ value: 'default' }, { value: null })).toEqual({ value: null });
  });

  it('loads overrides while retaining unspecified defaults', () => {
    const { defaults, input } = fixture('settings:\n  port: 8443\n');
    expect(loadConfig(defaults, input)).toEqual({ settings: { port: 8443, selfUpdate: false } });
  });

  it('allows an empty YAML file', () => {
    const { defaults, input } = fixture('');
    expect(loadConfig(defaults, input)).toEqual({ settings: { port: 443, selfUpdate: false } });
  });

  it.each(['settings: [', 'settings: {}\nsettings: {}', '- item', 'settings: false'])(
    'rejects invalid configuration: %s',
    (yaml) => {
      const { defaults, input } = fixture(yaml);
      expect(() => loadConfig(defaults, input)).toThrow();
    },
  );

  it('rejects unsafe object keys', () => {
    expect(() => mergeConfig({}, JSON.parse('{"__proto__":{"polluted":true}}'))).toThrow();
  });

  it.each(['--config-yaml', '--configfile'])('generates JSON for %s and cleans up', (option) => {
    const { defaults, input } = fixture('settings:\n  port: 8443');
    const prepared = prepareConfig([`${option}=${input}`, '--datapath', '/data'], defaults);
    try {
      expect(prepared.args.slice(0, 3)).toEqual(['--datapath', '/data', '--configfile']);
      expect(JSON.parse(readFileSync(prepared.args[3]!, 'utf8')).settings.port).toBe(8443);
    } finally {
      prepared.cleanup();
    }
    expect(existsSync(prepared.args[3]!)).toBe(false);
    expect(readFileSync(input, 'utf8')).toBe('settings:\n  port: 8443');
  });

  it('preserves native JSON and no-config arguments', () => {
    expect(prepareConfig(['--configfile', 'native.json'], '').args).toEqual([
      '--configfile',
      'native.json',
    ]);
    expect(prepareConfig([], '').args).toEqual([]);
  });

  it('rejects missing and ambiguous configuration arguments', () => {
    expect(() => prepareConfig(['--config-yaml'], '')).toThrow();
    expect(() => prepareConfig(['--config-yaml', '--datapath'], '')).toThrow();
    expect(() =>
      prepareConfig(['--config-yaml', 'a.yaml', '--configfile', 'b.json'], ''),
    ).toThrow();
  });
});
