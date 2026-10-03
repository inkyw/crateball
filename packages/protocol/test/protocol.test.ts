import { describe, expect, it } from 'vitest';
import { PROTOCOL_VERSION, decodeClientMessage, decodeServerMessage, encode } from '../src/index';

describe('istemci mesajları', () => {
  it('hello gidiş-dönüş (token ile ve tokensız)', () => {
    const a = { t: 'hello', protocolVersion: PROTOCOL_VERSION } as const;
    const b = { t: 'hello', protocolVersion: PROTOCOL_VERSION, sessionToken: 'abc' } as const;
    expect(decodeClientMessage(encode(a))).toEqual(a);
    expect(decodeClientMessage(encode(b))).toEqual(b);
  });
  it('ping gidiş-dönüş', () => {
    expect(decodeClientMessage(encode({ t: 'ping', id: 7 }))).toEqual({ t: 'ping', id: 7 });
  });
  it('fazladan alanları atar', () => {
    expect(decodeClientMessage('{"t":"ping","id":3,"evil":true}')).toEqual({ t: 'ping', id: 3 });
  });
  it.each([
    'not json',
    '[]',
    'null',
    '{"t":"hello"}',
    '{"t":"hello","protocolVersion":-1}',
    `{"t":"hello","protocolVersion":1,"sessionToken":"${'x'.repeat(129)}"}`,
    '{"t":"ping","id":1.5}',
    '{"t":"nope"}',
  ])('geçersiz mesajı reddeder: %s', (raw) => {
    expect(decodeClientMessage(raw)).toBeNull();
  });
});

describe('sunucu mesajları', () => {
  it('welcome ve pong gidiş-dönüş', () => {
    const w = { t: 'welcome', protocolVersion: 1, clientId: 'ab12cd34', serverTime: 123 } as const;
    expect(decodeServerMessage(encode(w))).toEqual(w);
    expect(decodeServerMessage(encode({ t: 'pong', id: 2, serverTime: 5 }))).toEqual({
      t: 'pong',
      id: 2,
      serverTime: 5,
    });
  });
  it('Türkçe hata metni bozulmadan taşınır', () => {
    const e = {
      t: 'error',
      code: 'version_mismatch',
      message: 'Oyun güncellendi — sayfayı yenile (Şş Ğğ İı)',
    } as const;
    expect(decodeServerMessage(encode(e))).toEqual(e);
  });
  it('bilinmeyen hata kodunu reddeder', () => {
    expect(decodeServerMessage('{"t":"error","code":"boom","message":"x"}')).toBeNull();
  });
});
