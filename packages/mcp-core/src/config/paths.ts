import { homedir } from 'node:os';
import path from 'node:path';

export interface PathEnvironment {
  readonly APPDATA?: string;
  readonly XDG_CONFIG_HOME?: string;
  readonly HOME?: string;
}

export function defaultConfigDirectory(
  platform: string = process.platform,
  env: PathEnvironment = process.env,
): string {
  if (platform === 'win32') {
    const appData = env.APPDATA?.trim();
    return path.join(appData ? appData : path.join(homedir(), 'AppData', 'Roaming'), 'meshcentral-mcp');
  }
  const xdg = env.XDG_CONFIG_HOME?.trim();
  const base = xdg ? xdg : path.join(env.HOME?.trim() ? env.HOME.trim() : homedir(), '.config');
  return path.join(base, 'meshcentral-mcp');
}

export function defaultSessionFile(
  platform: string = process.platform,
  env: PathEnvironment = process.env,
): string {
  return path.join(defaultConfigDirectory(platform, env), 'session.json');
}

export function defaultAuditFile(
  platform: string = process.platform,
  env: PathEnvironment = process.env,
): string {
  return path.join(defaultConfigDirectory(platform, env), 'audit.ndjson');
}
