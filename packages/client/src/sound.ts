import type { ItemKind } from '@crateball/sim';
import type { GameEvent } from './events';

/**
 * Code-generated sound effects (WebAudio, no files), driven by `events.ts`.
 */
export interface Sound {
  unlock(): void;
  readonly muted: boolean;
  setMuted(m: boolean): void;
  play(e: GameEvent): void;
}

export function createSound(): Sound {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let noiseBuf: AudioBuffer | null = null;
  let muted = false;

  const tone = (type: OscillatorType, f0: number, f1: number, dur: number, vol: number, at = 0) => {
    if (!ctx || !master) return;
    const t = ctx.currentTime + at;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  };

  const noise = (dur: number, vol: number, filter: BiquadFilterType, freq: number, at = 0) => {
    if (!ctx || !master || !noiseBuf) return;
    const t = ctx.currentTime + at;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(master);
    src.start(t);
    src.stop(t + dur + 0.02);
  };

  const sfx = {
    kick: (power: boolean) => {
      tone('sine', power ? 140 : 190, 45, power ? 0.2 : 0.12, power ? 1 : 0.7);
      noise(0.04, 0.3, 'highpass', 2000);
    },
    whistle: (long: boolean) => {
      for (let i = 0; i < (long ? 3 : 1); i++) tone('square', 2900, 2700, long ? 0.35 : 0.25, 0.08, i * 0.45);
    },
    goal: () => {
      noise(1.6, 0.35, 'bandpass', 900);
      [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, f, 0.25, 0.25, i * 0.09));
    },
    shot: () => {
      noise(0.08, 0.5, 'highpass', 1200);
      tone('square', 900, 120, 0.08, 0.15);
    },
    hit: () => tone('sawtooth', 220, 60, 0.15, 0.3),
    item: (kind: ItemKind) => {
      switch (kind) {
        case 'mine':
          noise(0.7, 0.9, 'lowpass', 600);
          tone('sine', 120, 30, 0.5, 0.8);
          break;
        case 'ice':
          [1400, 1800, 2300].forEach((f, i) => tone('sine', f, f * 1.2, 0.3, 0.12, i * 0.05));
          break;
        case 'gun':
          noise(0.05, 0.4, 'bandpass', 3000);
          noise(0.05, 0.4, 'bandpass', 2000, 0.08);
          break;
        default:
          [440, 554, 659, 880].forEach((f, i) => tone('triangle', f, f, 0.12, 0.18, i * 0.05));
      }
    },
  };

  return {
    get muted() {
      return muted;
    },
    setMuted(m) {
      muted = m;
      if (master) master.gain.value = m ? 0 : 0.5;
    },
    unlock() {
      if (ctx) {
        void ctx.resume();
        return;
      }
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    },
    play(e) {
      switch (e.type) {
        case 'kick':
          sfx.kick(e.power);
          break;
        case 'shot':
          sfx.shot();
          break;
        case 'hit':
          sfx.hit();
          break;
        case 'item':
          sfx.item(e.kind);
          break;
        case 'goal':
          sfx.goal();
          break;
        case 'whistle':
          sfx.whistle(e.long);
          break;
      }
    },
  };
}
