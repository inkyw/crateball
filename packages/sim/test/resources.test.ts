import { describe, expect, it } from 'vitest';
import { RESOURCE_COUNTS } from '../src/content/index';
import { cellOf, cidx } from '../src/grid';
import { createGame, ids, spawnNode } from '../src/state';
import { step } from '../src/step';
import { hitNode } from '../src/systems/resources';
import type { SimEvent } from '../src/types';

describe('kaynaklar', () => {
  it('kaya 4 vuruşta kırılır → 2 stone; 1 sn sonra başka yerde yenisi doğar', () => {
    const s = createGame(1);
    const [i, j] = cellOf(0.5, 5.5);
    const rock = spawnNode(s, 'rock', i, j);
    const events: SimEvent[] = [];
    for (let k = 0; k < 3; k++) hitNode(s, rock, 0, 3.5, 1, events);
    expect(s.nodes[rock.id]!.hitsLeft).toBe(1);
    expect(s.resources.stone).toBe(0);
    hitNode(s, rock, 0, 3.5, 1, events);
    expect(s.nodes[rock.id]).toBeUndefined();
    expect(s.occ[cidx(i, j)]).toBe(0);
    expect(s.resources.stone).toBe(2);
    expect(events.map((e) => e.t)).toEqual(['nodeRemoved', 'resourceGained']);
    expect(s.pendingRespawns).toEqual([{ kind: 'rock', atTick: 20 }]);
    const all: SimEvent[] = [];
    for (let k = 0; k < 20; k++) all.push(...step(s, []).events);
    expect(all.some((e) => e.t === 'nodeSpawned')).toBe(true);
    expect(ids(s.nodes).filter((id) => s.nodes[id]!.kind === 'rock')).toHaveLength(RESOURCE_COUNTS.rock + 1);
    expect(s.pendingRespawns).toEqual([]);
  });
  it('çalı 2 vuruşta temizlenir, kaynak vermez, yeniden doğmaz', () => {
    const s = createGame(1);
    const [i, j] = cellOf(0.5, 5.5);
    const bush = spawnNode(s, 'bush', i, j);
    const events: SimEvent[] = [];
    hitNode(s, bush, 0, 3.5, 1, events);
    hitNode(s, bush, 0, 3.5, 1, events);
    expect(s.nodes[bush.id]).toBeUndefined();
    expect(s.resources).toEqual({ wood: 10, stone: 0 });
    expect(s.pendingRespawns).toEqual([]);
    expect(events.map((e) => e.t)).toEqual(['nodeRemoved']);
  });
});
