import { HEARTH_POS } from '../content/island';
import { DT } from '../content/time';
import {
  NIGHT1_WAVES,
  SPAWN_JITTER,
  SPAWN_MIN_DIST_FROM_HEARTH,
  type WaveDef,
  waveMultiplier,
} from '../content/waves';
import { cellCenter, cellCoords } from '../grid';
import { coastCells } from '../island';
import { nextRandom, randInt, spawnCreature } from '../state';
import { type CellIndex, type CreatureKind, type GameState, type SimEvent, UNREACHABLE } from '../types';

const KINDS: readonly CreatureKind[] = ['shadeling', 'stumpkin', 'glowbug'];

/** Kıyı hücreleri: Hearth'tan ≥ 14 ve Hearth'a yolu olan. */
export function spawnCells(state: GameState): CellIndex[] {
  return coastCells(state.island).filter((c) => {
    const [i, j] = cellCoords(c);
    const [x, z] = cellCenter(i, j);
    return (
      Math.hypot(x - HEARTH_POS.x, z - HEARTH_POS.z) >= SPAWN_MIN_DIST_FROM_HEARTH &&
      (state.flow.hearth.dist[c] ?? UNREACHABLE) < UNREACHABLE
    );
  });
}

export function waveCounts(night: number, wave: WaveDef): Record<CreatureKind, number> {
  const m = waveMultiplier(night);
  return {
    shadeling: Math.round(wave.shadeling * m),
    stumpkin: Math.round(wave.stumpkin * m),
    glowbug: Math.round(wave.glowbug * m),
  };
}

function spawnWave(state: GameState, wave: WaveDef, events: SimEvent[]): void {
  const cells = spawnCells(state);
  if (cells.length === 0) return;
  const counts = waveCounts(state.night, wave);
  for (const kind of KINDS)
    for (let n = 0; n < counts[kind]; n++) {
      const [i, j] = cellCoords(cells[randInt(state, 0, cells.length)] as number);
      const [cx, cz] = cellCenter(i, j);
      const x = cx + (nextRandom(state) - 0.5) * 2 * SPAWN_JITTER;
      const z = cz + (nextRandom(state) - 0.5) * 2 * SPAWN_JITTER;
      const c = spawnCreature(state, kind, x, z);
      events.push({ t: 'creatureSpawned', id: c.id, kind, x, z });
    }
}

/** Gece boyunca sırası gelen dalgaları doğurur (gece başı dahil). */
export function updateWaves(state: GameState, events: SimEvent[]): void {
  if (state.phase !== 'night') return;
  const elapsedS = (state.tick - state.phaseStartTick) * DT;
  while (
    state.wavesSpawned < NIGHT1_WAVES.length &&
    (NIGHT1_WAVES[state.wavesSpawned] as WaveDef).atS <= elapsedS
  ) {
    spawnWave(state, NIGHT1_WAVES[state.wavesSpawned] as WaveDef, events);
    state.wavesSpawned++;
  }
}
