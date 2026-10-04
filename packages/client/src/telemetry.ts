import type { ClientStats } from '@crateball/protocol';

const WINDOW_MS = 2000;
const KEEP = 5;
/** A frame slower than this is visible as a hitch. */
const LONG_FRAME_MS = 25;

/**
 * Cheap per-frame counters, summarised every 2 s while a match runs. The server only logs the
 * summaries; R (or F9) sends the last ~10 s as a marked report so a "that felt wrong" moment can be found.
 */
export function createTelemetry(read: () => Omit<ClientStats, 'fps' | 'frameMsMax' | 'longFrames'>) {
  let start = performance.now();
  let frames = 0;
  let frameMsMax = 0;
  let longFrames = 0;
  const recent: ClientStats[] = [];
  return {
    recent: () => [...recent],
    /** Call once per frame; returns a finished window every ~2 s, otherwise null. */
    frame(now: number, frameGapMs: number, playing: boolean): ClientStats | null {
      if (!playing) {
        start = now;
        frames = frameMsMax = longFrames = 0;
        return null;
      }
      frames++;
      frameMsMax = Math.max(frameMsMax, frameGapMs);
      if (frameGapMs > LONG_FRAME_MS) longFrames++;
      if (now - start < WINDOW_MS) return null;
      const s: ClientStats = { fps: (frames * 1000) / (now - start), frameMsMax, longFrames, ...read() };
      recent.push(s);
      if (recent.length > KEEP) recent.shift();
      start = now;
      frames = frameMsMax = longFrames = 0;
      return s;
    },
  };
}
