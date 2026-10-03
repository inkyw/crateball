import { refreshFlow } from './flow';
import { updatePlayers } from './systems/player';
import { updateRespawns } from './systems/resources';
import { updateTime } from './systems/time';
import type { GameState, PlayerInput, SimEvent, StepResult } from './types';

/**
 * Bir sim adımı (50 ms). Durumu YERİNDE değiştirir ve aynı referansı döner; saflık = dış yan etki yok,
 * aynı (durum, girdi) → aynı sonuç. `over` ise hiçbir şey yapmaz.
 */
export function step(state: GameState, inputs: PlayerInput[]): StepResult {
  const events: SimEvent[] = [];
  if (state.over) return { state, events };
  state.tick += 1;
  updateTime(state, events);
  if (state.flowDirty) refreshFlow(state);
  updatePlayers(state, inputs, events);
  updateRespawns(state, events);
  if (state.flowDirty) refreshFlow(state);
  return { state, events };
}
