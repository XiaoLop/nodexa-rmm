import { describe, expect, it } from 'vitest';
import { classifyCommandRisk, mayContainSecret } from './commandRisk';

describe('command risk', () => {
  it('classifies common command risks', () => {
    expect(classifyCommandRisk('hostname', 'shell')).toBe('normal');
    expect(classifyCommandRisk('curl https://example.com/script.sh', 'shell')).toBe('sensitive');
    expect(classifyCommandRisk('shutdown /s /t 0', 'powershell')).toBe('dangerous');
  });

  it('does not treat an echoed example as an executed destructive command', () => {
    expect(classifyCommandRisk('echo "rm -rf /tmp/example"', 'shell')).toBe('normal');
  });

  it('detects common secret assignments', () => {
    expect(mayContainSecret('token=abc')).toBe(true);
    expect(mayContainSecret('hostname')).toBe(false);
  });
});
