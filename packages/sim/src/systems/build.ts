import { BUILDINGS, HOTBAR } from '../content/buildings';
import { ISSUE, evaluatePlacement, fenceLineCells, footprintCells } from '../placement';
import { addBuilding } from '../state';
import type { BuildableKind, EntityId, GameState, PlaceCommand, Rotation, SimEvent } from '../types';

export const MAX_FENCE_LINE = 64;
export const UNKNOWN_BUILDING = 'Unknown building';
export const PLAYER_DOWN = 'Player is down';

export function canAfford(state: GameState, kind: BuildableKind): string | null {
  const c = BUILDINGS[kind].cost;
  if (state.resources.wood < c.wood) return ISSUE.wood;
  if (state.resources.stone < c.stone) return ISSUE.stone;
  return null;
}
function pay(state: GameState, kind: BuildableKind): void {
  state.resources.wood -= BUILDINGS[kind].cost.wood;
  state.resources.stone -= BUILDINGS[kind].cost.stone;
}
const reject = (events: SimEvent[], playerId: EntityId, reason: string): void => {
  events.push({ t: 'buildRejected', playerId, reason });
};

/** Çit: uçlardan hat; engelli hücre atlanır; odun bitince durur. Hiç konamazsa son sebeple red. */
function placeFenceLine(state: GameState, playerId: EntityId, cmd: PlaceCommand, events: SimEvent[]): void {
  const given = cmd.cells && cmd.cells.length > 0 ? cmd.cells : [[cmd.i, cmd.j] as [number, number]];
  const line = fenceLineCells(given[0]!, given[given.length - 1]!).slice(0, MAX_FENCE_LINE);
  // Sürüklenen hattın yönünü hat belirler (yatay → 0, dikey → 1); tek hücrede oyuncunun rot'u.
  const rot: Rotation = line.length > 1 ? (line[0]![1] === line[line.length - 1]![1] ? 0 : 1) : cmd.rot;
  let placed = 0;
  let lastIssue: string | null = null;
  for (const cell of evaluatePlacement(state, 'fence', line)) {
    if (cell.issue) {
      lastIssue = cell.issue;
      continue;
    }
    const afford = canAfford(state, 'fence');
    if (afford) {
      lastIssue = afford;
      break;
    }
    pay(state, 'fence');
    const b = addBuilding(state, 'fence', cell.i, cell.j, rot);
    events.push({ t: 'built', id: b.id, kind: 'fence', cells: b.cells });
    placed++;
  }
  if (placed === 0) reject(events, playerId, lastIssue ?? ISSUE.occupied);
}

/** Oyuncunun yerleştirme komutu (sunucu otoritesi için tüm kurallar burada yeniden doğrulanır). */
export function applyPlacement(
  state: GameState,
  playerId: EntityId,
  cmd: PlaceCommand,
  events: SimEvent[],
): void {
  const player = state.players[playerId];
  if (!player || player.dead) return reject(events, playerId, PLAYER_DOWN);
  if (!HOTBAR.includes(cmd.kind)) return reject(events, playerId, UNKNOWN_BUILDING);
  if (cmd.kind === 'fence') return placeFenceLine(state, playerId, cmd, events);
  const cells = footprintCells(cmd.kind, cmd.i, cmd.j);
  const bad = evaluatePlacement(state, cmd.kind, cells).find((c) => c.issue);
  if (bad) return reject(events, playerId, bad.issue as string);
  const afford = canAfford(state, cmd.kind);
  if (afford) return reject(events, playerId, afford);
  pay(state, cmd.kind);
  const b = addBuilding(state, cmd.kind, cmd.i, cmd.j, cmd.rot);
  events.push({ t: 'built', id: b.id, kind: cmd.kind, cells: b.cells });
}
