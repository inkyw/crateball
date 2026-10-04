import { expect, test } from '@playwright/test';

type Render = {
  fps: number;
  frameMs: number;
  calls: number;
  triangles: number;
  night: number;
  effects: { ao: boolean; bloom: boolean; tilt: boolean };
};
type Sim = {
  phase: string;
  tick: number;
  counts: {
    creatures: { shadeling: number };
    buildings: { fence: number; arrowTower: number; lantern: number };
  };
};
type Page = Parameters<Parameters<typeof test>[2]>[0]['page'];
const cmd = <T = unknown>(page: Page, name: string, ...args: unknown[]) =>
  page.evaluate(([n, a]) => window.__game!.cmd(n as string, ...(a as unknown[])) as T, [name, args] as const);
const state = (page: Page) => page.evaluate(() => window.__game!.getState() as { render: Render; sim: Sim });

export const DRAW_CALL_BUDGET = 150;
export const TRIANGLE_BUDGET = 500_000;

test('bütçe sahnesi: 200 Shadeling + gece + binalar + tüm efektler', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/?debug&seed=1');
  await page.waitForFunction(
    () => !!window.__game && (window.__game.getState() as { sim: { tick: number } }).sim.tick > 2,
  );
  await cmd(page, 'god', true);
  await cmd(page, 'skipTo', 'night');
  // Night lighting settles first (night = 20% in -> ~1) via 300 ticks; buildings and Shadelings come afterwards, since the wave and lanterns would destroy them during the wait.
  await cmd(page, 'step', 300);
  await cmd(page, 'give', 500, 500);
  // Binalar normal yerleştirme hattından geçer; her çağrının başarısı doğrulanır.
  for (let k = 0; k < 12; k++)
    expect(await cmd<string[]>(page, 'build', 'fence', 26 + k, 27, 0)).toEqual(['built']);
  expect(await cmd<string[]>(page, 'build', 'arrowTower', 34, 34, 0)).toEqual(['built']);
  expect(await cmd<string[]>(page, 'build', 'lantern', 29, 34, 0)).toEqual(['built']);
  expect(await cmd<string[]>(page, 'build', 'lantern', 36, 29, 1)).toEqual(['built']);
  await cmd(page, 'spawn', 'shadeling', 220); // a margin: lanterns/tower thin them a little while they grow
  await cmd(page, 'step', 20); // SPAWN_GROW_S 0.4 s = 8 ticks
  await cmd(page, 'timeScale', 0); // sim donar, render sürer: sahne sabit
  const s0 = await state(page);
  expect(s0.sim.phase).toBe('night');
  expect(s0.sim.counts.creatures.shadeling).toBeGreaterThanOrEqual(200);
  expect(s0.sim.counts.buildings).toMatchObject({ fence: 12, arrowTower: 1, lantern: 2 });
  await page.waitForTimeout(500);
  const r0 = (await state(page)).render;
  expect(r0.night).toBeGreaterThanOrEqual(0.9);
  expect(r0.effects).toEqual({ ao: true, bloom: true, tilt: true });
  await page.waitForTimeout(1000);
  const samples: Render[] = [];
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(250);
    samples.push((await state(page)).render);
  }
  const calls = Math.max(...samples.map((s) => s.calls));
  const triangles = Math.max(...samples.map((s) => s.triangles));
  const frameMs = samples.reduce((a, s) => a + s.frameMs, 0) / samples.length;
  const report = `draw calls ${calls}/${DRAW_CALL_BUDGET} · triangles ${triangles}/${TRIANGLE_BUDGET} · CPU ms/frame ${frameMs.toFixed(1)} (headless, bilgi amaçlı)`;
  console.log(`[perf] ${report}`);
  test.info().annotations.push({ type: 'perf', description: report });
  expect(calls).toBeGreaterThan(0);
  expect(calls).toBeLessThanOrEqual(DRAW_CALL_BUDGET);
  expect(triangles).toBeLessThanOrEqual(TRIANGLE_BUDGET);
});
