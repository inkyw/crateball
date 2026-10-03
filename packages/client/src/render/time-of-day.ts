import { todFromPhase } from '@gg/assets';
import type { GameState } from '@gg/sim';

/** Sim fazı + tick (+ kareler arası alpha) → 0..1 gün saati. */
export function timeOfDay(state: GameState, alpha: number): number {
  const total = Math.max(1, state.phaseEndTick - state.phaseStartTick);
  const progress = (state.tick + alpha - state.phaseStartTick) / total;
  return todFromPhase(state.phase, progress);
}
