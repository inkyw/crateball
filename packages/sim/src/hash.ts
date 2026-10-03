/**
 * Anahtarları sıralı, undefined alanları atlayan JSON; aynı veri her zaman aynı metni verir.
 * Yalnızca düz JSON verisini destekler (nesne, dizi, string, sonlu sayı, boolean, null);
 * Map/Set/Date/sınıf örnekleri/toJSON DESTEKLENMEZ ve sim durumuna konmamalıdır.
 */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  // Array.from boşlukları undefined olarak gezer (map atlardı) → JSON.stringify gibi null yazılır.
  if (Array.isArray(value)) return `[${Array.from(value, (v) => stableStringify(v)).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

/** Durum özeti (FNV-1a 32 bit, 8 hex). Determinizm ve replay kontrolleri için. */
export function hashState(value: unknown): string {
  const s = stableStringify(value);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}
