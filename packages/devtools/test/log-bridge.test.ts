import { describe, expect, it, vi } from 'vitest';
import {
  MAX_BATCH_BYTES,
  MAX_MSG_CHARS,
  createLogBatcher,
  formatArgs,
  installLogBridge,
  type LogEntry,
  type LogLevel,
} from '../src/log-bridge';

function harness() {
  const sent: LogEntry[][] = [];
  const timers: Array<{ fn: () => void; ms: number }> = [];
  const batcher = createLogBatcher({
    clientId: 'c-1',
    send: async (e) => {
      sent.push(e);
    },
    now: () => 42,
    schedule: (fn, ms) => timers.push({ fn, ms }),
  });
  return { sent, timers, batcher };
}

describe('formatArgs', () => {
  it('metin, nesne ve hata biçimler', () => {
    expect(formatArgs(['a', { b: 1 }, 3])).toBe('a {"b":1} 3');
    expect(formatArgs([new Error('patladı')])).toContain('patladı');
  });
  it('döngüsel nesnede çökmez', () => {
    const o: Record<string, unknown> = {};
    o.self = o;
    expect(formatArgs([o])).toBe('[object Object]');
  });
  it(`${MAX_MSG_CHARS} karakterde keser`, () => {
    expect(formatArgs(['x'.repeat(MAX_MSG_CHARS + 50)])).toHaveLength(MAX_MSG_CHARS);
  });
});

describe('createLogBatcher', () => {
  it('kayıtları 500 ms sonra tek pakette gönderir', async () => {
    const { sent, timers, batcher } = harness();
    batcher.push('log', ['bir']);
    batcher.push('warn', ['iki']);
    expect(timers).toHaveLength(1);
    expect(timers[0]?.ms).toBe(500);
    timers[0]?.fn();
    await batcher.flush();
    expect(sent).toEqual([
      [
        { level: 'log', msg: 'bir', clientId: 'c-1', ts: 42 },
        { level: 'warn', msg: 'iki', clientId: 'c-1', ts: 42 },
      ],
    ]);
  });
  it('log selinde paket 64 KB altında kalır ve düşürülen sayıyı bildirir', async () => {
    const { sent, batcher } = harness();
    for (let i = 0; i < 10_000; i++) batcher.push('log', ['x'.repeat(100)]);
    expect(batcher.pendingBytes).toBeLessThanOrEqual(MAX_BATCH_BYTES);
    await batcher.flush();
    const body = JSON.stringify(sent[0]);
    expect(new TextEncoder().encode(body).length).toBeLessThan(64 * 1024);
    expect(sent[0]?.at(-1)?.msg).toMatch(/^\[log-bridge\] \d+ entries dropped/);
  });
  it('JSON kaçışı ağır metinde (NUL, \\, ", Türkçe) de paket 64 KB altında kalır', async () => {
    const { sent, batcher } = harness();
    const nasty = '\u0000\\"Şğİı'.repeat(300);
    for (let i = 0; i < 10_000; i++) batcher.push('log', [nasty]);
    await batcher.flush();
    expect(new TextEncoder().encode(JSON.stringify(sent[0])).length).toBeLessThan(64 * 1024);
  });
  it('gönderim takılırsa yeni gönderim başlatmaz ve tampon sınırlı kalır', async () => {
    let calls = 0;
    const timers: Array<() => void> = [];
    const batcher = createLogBatcher({
      clientId: 'c',
      send: () => {
        calls++;
        return new Promise<void>(() => {});
      },
      schedule: (fn) => timers.push(fn),
    });
    batcher.push('log', ['ilk']);
    timers.shift()?.();
    for (let round = 0; round < 5; round++) {
      for (let i = 0; i < 2000; i++) batcher.push('log', ['x'.repeat(100)]);
      timers.shift()?.();
    }
    expect(calls).toBe(1);
    expect(batcher.pendingBytes).toBeLessThanOrEqual(MAX_BATCH_BYTES);
  });
  it('gönderim hatasını yutar', async () => {
    const batcher = createLogBatcher({
      clientId: 'c',
      send: () => Promise.reject(new Error('sunucu yok')),
      schedule: () => 0,
    });
    batcher.push('error', ['x']);
    await expect(batcher.flush()).resolves.toBeUndefined();
  });
});

describe('installLogBridge', () => {
  it('konsolu sarar, orijinali çağırır ve Türkçe metni gönderir', async () => {
    const calls: unknown[][] = [];
    const target = Object.fromEntries(
      (['debug', 'log', 'info', 'warn', 'error'] as LogLevel[]).map((l) => [
        l,
        (...a: unknown[]) => calls.push(a),
      ]),
    ) as unknown as Pick<Console, LogLevel>;
    const listeners: Record<string, (e: unknown) => void> = {};
    const win = {
      addEventListener: (t: string, fn: (e: unknown) => void) => (listeners[t] = fn),
    } as unknown as Pick<Window, 'addEventListener'>;
    const fetchFn = vi.fn(async () => new Response(null, { status: 204 }));
    const batcher = installLogBridge({ endpoint: '/__log', clientId: 'c-9', target, win, fetchFn });
    target.warn('Şafak söktü ğüşıöç');
    listeners.error?.({ error: new Error('pencere hatası') });
    await batcher.flush();
    expect(calls).toEqual([['Şafak söktü ğüşıöç']]);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/__log');
    const body = JSON.parse(init.body as string) as LogEntry[];
    expect(body.map((e) => e.level)).toEqual(['warn', 'error']);
    expect(body[0]?.msg).toBe('Şafak söktü ğüşıöç');
    expect(body[1]?.msg).toContain('pencere hatası');
  });
});
