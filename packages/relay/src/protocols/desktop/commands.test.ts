import { describe, expect, it } from 'vitest';
import { createCadMessage, createCompressionMessage, createKeyMessage, createMouseButtonMessage, createMouseMoveMessage, createMouseWheelMessage, createUnicodeMessage } from './commands';

describe('desktop input commands', () => {
  it('encodes mouse movement and buttons with big-endian coordinates', () => {
    expect([...createMouseMoveMessage({ x: 100, y: 200 })]).toEqual([0, 2, 0, 10, 0, 0, 0, 100, 0, 200]);
    expect([...createMouseButtonMessage('left', 'down', { x: 100, y: 200 })]).toEqual([0, 2, 0, 10, 0, 2, 0, 100, 0, 200]);
    expect([...createMouseButtonMessage('right', 'up', { x: 100, y: 200 })]).toEqual([0, 2, 0, 10, 0, 16, 0, 100, 0, 200]);
  });

  it('encodes wheel, keyboard, unicode and CAD commands', () => {
    expect([...createMouseWheelMessage({ x: 1, y: 2 }, 120)]).toEqual([0, 2, 0, 12, 0, 0, 0, 1, 0, 2, 0, 120]);
    expect([...createKeyMessage(65, 'down')]).toEqual([0, 1, 0, 6, 0, 65]);
    expect([...createKeyMessage(37, 'up', true)]).toEqual([0, 1, 0, 6, 3, 37]);
    expect([...createUnicodeMessage(0x4e2d, 'down')]).toEqual([0, 85, 0, 7, 0, 0x4e, 0x2d]);
    expect([...createCadMessage()]).toEqual([0, 10, 0, 4]);
  });

  it('encodes desktop image quality settings', () => {
    expect([...createCompressionMessage({ quality: 58 })]).toEqual([0, 5, 0, 10, 1, 58, 4, 0, 0, 100]);
    expect(() => createCompressionMessage({ quality: 0 })).toThrow('integer from 1 to 100');
  });
});
