import { describe, expect, it } from 'vitest';

import type { Device } from '@meshcentral/control-client';

import { fitToBudget, pickFields, projectDevice, stripRaw } from './projection';

describe('stripRaw', () => {
  it('removes raw keys recursively', () => {
    const input = {
      id: 'node//a',
      raw: { huge: 'payload' },
      nested: { raw: [1, 2, 3], keep: true },
      list: [{ raw: 'x', value: 1 }],
    };
    expect(stripRaw(input)).toEqual({
      id: 'node//a',
      nested: { keep: true },
      list: [{ value: 1 }],
    });
  });

  it('keeps primitives untouched', () => {
    expect(stripRaw('value')).toBe('value');
    expect(stripRaw(7)).toBe(7);
    expect(stripRaw(null)).toBeNull();
  });
});

describe('projectDevice', () => {
  it('drops protocol-only fields', () => {
    const device: Device = {
      id: 'node//a',
      name: 'workstation',
      online: true,
      raw: { secret: true },
      grants: { 'user//1': { principalId: 'user//1', rights: 0xffffffff } },
      effectiveRights: 0xffffffff,
      machineType: 1,
    };
    expect(projectDevice(device)).toEqual({
      id: 'node//a',
      name: 'workstation',
      online: true,
    });
  });
});

describe('pickFields', () => {
  it('returns only known keys', () => {
    expect(pickFields({ hostname: 'pc', cpu: 'x', extra: 1 }, ['hostname', 'cpu'])).toEqual({
      hostname: 'pc',
      cpu: 'x',
    });
  });

  it('returns undefined for non objects', () => {
    expect(pickFields('value', ['a'])).toBeUndefined();
    expect(pickFields([1, 2], ['a'])).toBeUndefined();
  });
});

describe('fitToBudget', () => {
  it('passes through small payloads', () => {
    const payload = { items: [{ id: 'a' }] };
    expect(fitToBudget(payload, 1024)).toEqual({ value: payload, truncated: false });
  });

  it('shrinks payloads that exceed the budget', () => {
    const payload = { items: Array.from({ length: 100 }, (_, index) => ({ id: `id-${index}` })) };
    const result = fitToBudget(payload, 200);
    expect(result.truncated).toBe(true);
    expect(JSON.stringify(result.value).length).toBeLessThanOrEqual(200);
  });

  it('gives up when the payload cannot be shrunk enough', () => {
    const result = fitToBudget({ a: 'x'.repeat(1000) }, 10);
    expect(result.truncated).toBe(true);
    expect(result.value).toMatchObject({ truncated: true });
  });
});
