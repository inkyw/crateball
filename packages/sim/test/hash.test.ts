import { describe, expect, it } from 'vitest';
import { hashState, stableStringify } from '../src/hash';

describe('hashState', () => {
  it('sabit referans değer üretir', () => {
    expect(hashState({ a: 1, b: [1, 2] })).toBe('2a48ec0e');
  });
  it('anahtar sırasından bağımsızdır', () => {
    expect(hashState({ b: [1, 2], a: 1 })).toBe(hashState({ a: 1, b: [1, 2] }));
  });
  it('dizi sırası önemlidir', () => {
    expect(hashState({ a: 1, b: [2, 1] })).toBe('569e457e');
  });
  it('undefined alanları yok sayar', () => {
    expect(hashState({ a: 1, b: [1, 2], c: undefined })).toBe('2a48ec0e');
  });
  it('seyrek dizideki boşlukları JSON gibi null yazar', () => {
    expect(stableStringify(new Array(2))).toBe('[null,null]');
    const holey: number[] = [1];
    holey[2] = 3; // indeks 1 boş kalır
    expect(stableStringify(holey)).toBe(JSON.stringify(holey));
  });
  it('tek boşluklu dizi boş diziyle aynı özeti vermez', () => {
    expect(hashState(new Array(1))).not.toBe(hashState([]));
  });
});
