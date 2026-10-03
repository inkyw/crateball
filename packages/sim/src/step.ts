import { refreshFlow } from './flow';
import { applyPlacement } from './systems/build';
import { updateCreatures } from './systems/creatures';
import { updatePlayers } from './systems/player';
import { updateRespawns } from './systems/resources';
import { updateTime } from './systems/time';
import { updateProjectiles, updateTowers } from './systems/towers';
import { updateWaves } from './systems/waves';
import type { GameState, PlayerInput, SimEvent, StepResult } from './types';

/**
 * Bir sim adımı (50 ms). Durumu YERİNDE değiştirir ve aynı referansı döner; saflık = dış yan etki yok,
 * aynı (durum, girdi) → aynı sonuç. `over` ise hiçbir şey yapmaz.
 * Sıra: zaman → flow → oyuncular → yerleştirme → yeniden doğma → flow → dalgalar → yaratıklar → kuleler → oklar → flow.
 */
export function step(state: GameState, inputs: PlayerInput[]): StepResult {
  const events: SimEvent[] = [];
  if (state.over) return { state, events };
  state.tick += 1;
  updateTime(state, events);
  if (state.flowDirty) refreshFlow(state);
  updatePlayers(state, inputs, events);
  for (const input of inputs) if (input.place) applyPlacement(state, input.playerId, input.place, events);
  updateRespawns(state, events);
  if (state.flowDirty) refreshFlow(state);
  updateWaves(state, events);
  updateCreatures(state, events);
  updateTowers(state, events);
  updateProjectiles(state, events);
  if (state.flowDirty) refreshFlow(state);
  return { state, events };
}
