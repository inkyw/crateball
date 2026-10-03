import { DAY_S, NIGHT_S, secondsToTicks } from '../content/time';
import { ids } from '../state';
import type { GameState, SimEvent } from '../types';

/** Gündüz 90 sn → gece (gece n = gün n) → şafak: gün n+1, kalan yaratıklar ve oklar dağılır. */
export function updateTime(state: GameState, events: SimEvent[]): void {
  if (state.tick < state.phaseEndTick) return;
  state.phaseStartTick = state.tick;
  if (state.phase === 'day') {
    state.phase = 'night';
    state.night = state.day;
    state.wavesSpawned = 0;
    state.phaseEndTick = state.tick + secondsToTicks(NIGHT_S);
  } else {
    state.phase = 'day';
    state.day += 1;
    state.phaseEndTick = state.tick + secondsToTicks(DAY_S);
    for (const id of ids(state.creatures)) delete state.creatures[id];
    for (const id of ids(state.projectiles)) delete state.projectiles[id];
  }
  events.push({ t: 'phaseChanged', phase: state.phase, day: state.day, night: state.night });
}
