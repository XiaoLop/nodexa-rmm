import { describe, expect, it } from 'vitest';
import { parseDesktopCaptureScenario, scenarioMessages } from './desktopCaptureScenarios';

describe('desktop capture scenarios', () => {
  it('rejects unknown scenarios instead of silently running a basic connection', () => {
    expect(() => parseDesktopCaptureScenario('mouse-typo')).toThrow('Unsupported');
  });

  it('encodes refresh and mouse release messages with big-endian headers', () => {
    expect([...scenarioMessages('control-refresh')[0]!]).toEqual([0, 6, 0, 4]);
    const mouseMessages = scenarioMessages('mouse-left');
    expect([...mouseMessages[0]!].slice(0, 6)).toEqual([0, 2, 0, 10, 0, 2]);
    expect([...mouseMessages[1]!].slice(0, 6)).toEqual([0, 2, 0, 10, 0, 4]);
  });
});