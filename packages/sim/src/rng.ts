/** Deterministik PRNG (mulberry32). Aynı seed her JS motorunda aynı diziyi verir. */
export interface Rng {
  /** [0, 1) aralığında sayı. */
  next(): number;
  /** [min, maxExclusive) aralığında tam sayı. */
  int(min: number, maxExclusive: number): number;
  /** Kaydedilebilir iç durum; createRng(state) kaldığı yerden devam eder. */
  state(): number;
}

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min, maxExclusive) => min + Math.floor(next() * (maxExclusive - min)),
    state: () => a,
  };
}
