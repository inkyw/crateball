import { describe, expect, it } from 'vitest';
import { createDebugBridge } from '../src/bridge';

describe('createDebugBridge', () => {
  it('ping yerleşik komuttur', () => {
    expect(createDebugBridge(() => null).cmd('ping')).toBe('pong');
  });
  it('bilinmeyen komut mevcut komutları listeleyerek hata verir', () => {
    expect(() => createDebugBridge(() => null).cmd('yok')).toThrow('Unknown command: yok. Available: ping');
  });
  it('kayıtlı komutu argümanlarla çalıştırır', () => {
    const b = createDebugBridge(() => null);
    b.register('topla', (a, c) => (a as number) + (c as number));
    expect(b.cmd('topla', 2, 3)).toBe(5);
    expect(b.commands()).toEqual(['ping', 'topla']);
  });
  it('aynı adı iki kez kaydetmez', () => {
    const b = createDebugBridge(() => null);
    expect(() => b.register('ping', () => 1)).toThrow('Command already registered: ping');
  });
  it('getState her çağrıda güncel durumu okur', () => {
    let n = 1;
    const b = createDebugBridge(() => ({ n }));
    n = 2;
    expect(b.getState()).toEqual({ n: 2 });
  });
});
