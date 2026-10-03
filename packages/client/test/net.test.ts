import { describe, expect, it } from 'vitest';
import { PROTOCOL_VERSION, decodeClientMessage, encode } from '@gg/protocol';
import { BACKOFF_MS, connect, type NetStatus, type SocketLike } from '../src/net';

class FakeSocket implements SocketLike {
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((ev: { data: unknown }) => void) | null = null;
  onclose: (() => void) | null = null;
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.onclose?.();
  }
  receive(data: string) {
    this.onmessage?.({ data });
  }
}

function harness() {
  const sockets: FakeSocket[] = [];
  const delays: number[] = [];
  const pending: Array<() => void> = [];
  const statuses: NetStatus[] = [];
  const conn = connect({
    url: 'ws://test/ws',
    createSocket: () => {
      const s = new FakeSocket();
      sockets.push(s);
      return s;
    },
    schedule: (fn, ms) => {
      delays.push(ms);
      pending.push(fn);
    },
    onStatus: (s) => statuses.push(s),
  });
  const last = () => sockets[sockets.length - 1] as FakeSocket;
  const welcome = () =>
    last().receive(
      encode({ t: 'welcome', protocolVersion: PROTOCOL_VERSION, clientId: 'ab12cd34', serverTime: 1 }),
    );
  const runPending = () => pending.splice(0).forEach((fn) => fn());
  return { conn, sockets, delays, statuses, last, welcome, runPending };
}

describe('connect', () => {
  it('açılınca doğru sürümle hello gönderir', () => {
    const h = harness();
    h.last().onopen?.();
    expect(decodeClientMessage(h.last().sent[0] as string)).toEqual({
      t: 'hello',
      protocolVersion: PROTOCOL_VERSION,
    });
  });
  it('welcome ile open olur ve clientId tutar', () => {
    const h = harness();
    h.welcome();
    expect(h.conn.status).toBe('open');
    expect(h.conn.clientId).toBe('ab12cd34');
  });
  it('kopunca üstel bekleme ile tekrar dener, 10 sn ile sınırlı', () => {
    const h = harness();
    for (let i = 0; i < 7; i++) {
      h.last().close();
      h.runPending();
    }
    expect(h.delays).toEqual([500, 1000, 2000, 4000, 8000, 10000, 10000]);
    expect(h.sockets).toHaveLength(8);
    expect(h.statuses).toContain('closed');
  });
  it('başarılı bağlantıdan sonra bekleme sıfırlanır', () => {
    const h = harness();
    h.last().close();
    h.runPending();
    h.welcome();
    h.last().close();
    expect(h.delays).toEqual([500, 500]);
    expect(BACKOFF_MS[0]).toBe(500);
  });
  it('sürüm uyuşmazlığında denemeyi bırakır', () => {
    const h = harness();
    h.last().receive(
      encode({ t: 'error', code: 'version_mismatch', message: 'The game was updated — reload the page' }),
    );
    h.last().close();
    expect(h.conn.status).toBe('version_mismatch');
    expect(h.delays).toEqual([]);
  });
  it('bekleyen yeniden deneme varken close() çağrılırsa yeni soket açılmaz', () => {
    const h = harness();
    h.last().close();
    expect(h.delays).toEqual([500]);
    h.conn.close();
    h.runPending();
    expect(h.sockets).toHaveLength(1);
    expect(h.conn.status).toBe('closed');
  });
  it('close() sonrası tekrar denemez', () => {
    const h = harness();
    h.conn.close();
    expect(h.conn.status).toBe('closed');
    expect(h.delays).toEqual([]);
  });
  it('bozuk mesajı yok sayar', () => {
    const h = harness();
    h.last().receive('çöp');
    expect(h.conn.status).toBe('connecting');
  });
});
