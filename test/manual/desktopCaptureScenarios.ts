import { environmentNumber } from './captureHelpers';

export const DESKTOP_CAPTURE_SCENARIOS = [
  'connection-basic',
  'connection-with-refresh',
  'connection-with-unpause',
  'connection-with-compression',
  'connection-with-full-startup',
  'control-refresh',
  'control-pause-resume',
  'control-compression',
  'control-display-list',
  'control-display-select',
  'control-display-all',
  'control-input-lock-query',
  'mouse-move',
  'mouse-left',
  'mouse-right',
  'mouse-middle',
  'mouse-double-click',
  'mouse-drag',
  'keyboard-letter',
  'keyboard-unicode',
  'keyboard-cad',
] as const;

export type DesktopCaptureScenario = (typeof DESKTOP_CAPTURE_SCENARIOS)[number];

function desktopCommand(command: number, body: number[] = []): Uint8Array {
  const bytes = new Uint8Array(4 + body.length);
  const view = new DataView(bytes.buffer);
  view.setUint16(0, command);
  view.setUint16(2, bytes.byteLength);
  bytes.set(body, 4);
  return bytes;
}

function uint16(value: number): [number, number] {
  return [(value >> 8) & 0xff, value & 0xff];
}

export function parseDesktopCaptureScenario(value: string): DesktopCaptureScenario {
  if (!DESKTOP_CAPTURE_SCENARIOS.includes(value as DesktopCaptureScenario)) {
    throw new Error(`Unsupported DESKTOP_CAPTURE_SCENARIO: ${value}.`);
  }
  return value as DesktopCaptureScenario;
}

export function scenarioMessages(scenario: DesktopCaptureScenario): Uint8Array[] {
  const x = environmentNumber('DESKTOP_ACTION_X', 320);
  const y = environmentNumber('DESKTOP_ACTION_Y', 240);
  const keyCode = environmentNumber('DESKTOP_KEY_CODE', 65);
  const character = (process.env.DESKTOP_UNICODE_CHARACTER || '中').charCodeAt(0);
  const mouse = (flags: number) => desktopCommand(2, [0, flags, ...uint16(x), ...uint16(y)]);
  const keyboard = (flag: number) => desktopCommand(1, [flag, keyCode]);

  switch (scenario) {
    case 'connection-with-refresh':
    case 'control-refresh': return [desktopCommand(6)];
    case 'connection-with-unpause': return [desktopCommand(8, [0])];
    case 'connection-with-compression': return [desktopCommand(5, [1, 50, ...uint16(1024), ...uint16(100)])];
    case 'connection-with-full-startup': return [
      desktopCommand(5, [1, 50, ...uint16(1024), ...uint16(100)]),
      desktopCommand(8, [0]),
      desktopCommand(87, [2]),
    ];
    case 'control-pause-resume': return [desktopCommand(8, [1]), desktopCommand(8, [0])];
    case 'control-compression': return [desktopCommand(5, [1, 50, ...uint16(1024), ...uint16(100)])];
    case 'control-display-list': return [desktopCommand(11)];
    case 'control-display-select': return [desktopCommand(12, uint16(environmentNumber('DESKTOP_DISPLAY_ID', 0)))];
    case 'control-display-all': return [desktopCommand(12, [0xff, 0xff])];
    case 'control-input-lock-query': return [desktopCommand(87, [2])];
    case 'mouse-move': return [mouse(0)];
    case 'mouse-left': return [mouse(2), mouse(4)];
    case 'mouse-right': return [mouse(8), mouse(16)];
    case 'mouse-middle': return [mouse(32), mouse(64)];
    case 'mouse-double-click': return [mouse(0x88)];
    case 'mouse-drag': return [mouse(2), mouse(0), mouse(4)];
    case 'keyboard-letter': return [keyboard(0), keyboard(1)];
    case 'keyboard-unicode': return [
      desktopCommand(85, [0, ...uint16(character)]),
      desktopCommand(85, [1, ...uint16(character)]),
    ];
    case 'keyboard-cad': return [desktopCommand(10)];
    default: return [];
  }
}

export function isActionScenario(scenario: DesktopCaptureScenario): boolean {
  return /^(?:mouse-|keyboard-|control-)/.test(scenario);
}