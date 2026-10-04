import { describe, expect, it } from 'vitest';
import { connect, type SocketLike } from '../src/net';

describe('bağlantı', () => {
  it('el sıkışmadan önce gönderilen menü mesajı kaybolmaz, tick girdisi kuyruğa girmez', () => {
    const sent: string[] = [];
    let sock!: SocketLike;
    const conn = connect({
      url: 'ws://x',
      createSocket: () =>
        (sock = { send: (d) => sent.push(d), close: () => {}, onopen: null, onmessage: null, onclose: null }),
    });
    conn.send({ t: 'join', code: 'ABCD', name: 'A' });
    conn.send({ t: 'in', s: 1, b: 0 });
    sock.onopen?.();
    sock.onmessage?.({
      data: JSON.stringify({ t: 'welcome', protocolVersion: 3, clientId: 'c', serverTime: 1 }),
    });
    expect(sent.map((d) => (JSON.parse(d) as { t: string }).t)).toEqual(['hello', 'join']);
  });
});
