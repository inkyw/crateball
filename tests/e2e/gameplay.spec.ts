import { expect, test } from '@playwright/test';

type Summary = {
  seed: number;
  tick: number;
  phase: string;
  day: number;
  night: number;
  over: boolean;
  player: { x: number; z: number; hp: number; dead: boolean };
  hearth: { hp: number };
  resources: { wood: number; stone: number };
  counts: {
    creatures: Record<'shadeling' | 'stumpkin' | 'glowbug', number>;
    buildings: Record<'hearth' | 'fence' | 'arrowTower' | 'lantern', number>;
    nodes: Record<'tree' | 'rock' | 'bush', number>;
    projectiles: number;
  };
  build: { kind: string | null; rot: number };
};
type Page = Parameters<Parameters<typeof test>[2]>[0]['page'];

const sim = (page: Page) => page.evaluate(() => (window.__game!.getState() as { sim: Summary }).sim);
const cmd = <T = unknown>(page: Page, name: string, ...args: unknown[]) =>
  page.evaluate(([n, a]) => window.__game!.cmd(n as string, ...(a as unknown[])) as T, [name, args] as const);
const CENTER = { x: 640, y: 360 };

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/?seed=1');
  await page.waitForFunction(
    () => !!window.__game && (window.__game.getState() as { sim: { tick: number } }).sim.tick > 2,
  );
});

test('WASD ile hareket konumu değiştirir (D = ekranda sağ = dünya +x, -z)', async ({ page }) => {
  const before = (await sim(page)).player;
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(500);
  await page.keyboard.up('KeyD');
  const after = (await sim(page)).player;
  expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeGreaterThan(1);
  expect(after.x).toBeGreaterThan(before.x);
  expect(after.z).toBeLessThan(before.z);
  await expect(page.locator('#phase-label')).toHaveText('Day 1');
});

test('ağaca vurunca wood +3, ağaç devrilir ve başka yerde yenisi doğar', async ({ page }) => {
  const tree = await cmd<{ x: number; z: number; stand: { x: number; z: number } | null }>(
    page,
    'nearest',
    'tree',
  );
  expect(tree).toHaveProperty('stand');
  expect(tree.stand).not.toBeNull();
  expect(Math.hypot(tree.stand!.x - tree.x, tree.stand!.z - tree.z)).toBeLessThanOrEqual(1.8); // balta menzili 1.3 + 0.5
  await cmd(page, 'teleport', tree.stand!.x, tree.stand!.z);
  await cmd(page, 'aim', tree.x, tree.z);
  const s0 = await sim(page);
  await page.mouse.move(CENTER.x, CENTER.y);
  await page.mouse.down();
  await expect
    .poll(async () => (await sim(page)).resources.wood, { timeout: 6000 })
    .toBe(s0.resources.wood + 3);
  await page.mouse.up();
  await expect(page.locator('#res-wood')).toHaveText(String(s0.resources.wood + 3));
  await expect
    .poll(async () => (await sim(page)).counts.nodes.tree, { timeout: 5000 })
    .toBe(s0.counts.nodes.tree);
});

test('1 ile inşa modu, sürükleyerek çit hattı kurulur, Esc kapatır', async ({ page }) => {
  await cmd(page, 'teleport', 0, 5);
  await page.waitForTimeout(700); // kamera oyuncuya otursun
  await page.keyboard.press('Digit1');
  await expect.poll(async () => (await sim(page)).build.kind).toBe('fence');
  await expect(page.locator('#hotbar .slot[data-kind="fence"]')).toHaveClass(/on/);
  await page.mouse.move(CENTER.x + 120, CENTER.y);
  await expect(page.locator('#build-tip')).toBeVisible();
  await page.mouse.down();
  await page.mouse.move(CENTER.x + 120, CENTER.y + 60, { steps: 5 });
  await page.mouse.up();
  await expect.poll(async () => (await sim(page)).counts.buildings.fence).toBeGreaterThan(0);
  const s = await sim(page);
  expect(s.resources.wood).toBe(10 - 5 * s.counts.buildings.fence);
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await sim(page)).build.kind).toBeNull();
});

test("skipTo('night') sonrası dalga doğar ve HUD gece gösterir", async ({ page }) => {
  await cmd(page, 'god', true);
  const r = await cmd<{ phase: string; night: number }>(page, 'skipTo', 'night');
  expect(r).toMatchObject({ phase: 'night', night: 1 });
  const s = await sim(page);
  expect(s.counts.creatures.shadeling).toBe(6);
  expect(s.counts.creatures.glowbug).toBe(1);
  await expect(page.locator('#phase-label')).toHaveText('Night 1');
  await cmd(page, 'timeScale', 4);
  await expect
    .poll(async () => (await sim(page)).counts.creatures.stumpkin, { timeout: 15_000 })
    .toBeGreaterThan(0); // 25. sn dalgası
});

test('Hearth sönünce "The Hearth went out" ve "Try again" yeni run başlatır', async ({ page }) => {
  await cmd(page, 'god', true);
  await cmd(page, 'teleport', 12, 0);
  await cmd(page, 'skipTo', 'night');
  await cmd(page, 'spawn', 'stumpkin', 40, { x: 0, z: 0 });
  await cmd(page, 'timeScale', 5);
  await expect(page.locator('#gameover')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('#gameover h1')).toHaveText('The Hearth went out');
  expect((await sim(page)).over).toBe(true);
  await page.click('#retry');
  await expect(page.locator('#gameover')).toBeHidden();
  const fresh = await sim(page);
  expect(fresh.over).toBe(false);
  expect(fresh.hearth.hp).toBe(500);
  expect(fresh.phase).toBe('day');
  expect(fresh.seed).toBe(2); // "Try again" yeni seed: seed + 1
});

test('restart döngüsü GPU kaynaklarını sızdırmaz (geometri/doku sayısı büyümez)', async ({ page }) => {
  const mem = () =>
    page.evaluate(
      () =>
        (window.__game!.getState() as { render: { memory: { geometries: number; textures: number } } }).render
          .memory,
    );
  await cmd(page, 'restart', 2);
  await page.waitForTimeout(400);
  const base = await mem();
  expect(base.geometries).toBeGreaterThan(10);
  for (const s of [3, 4, 5]) {
    await cmd(page, 'restart', s);
    await page.waitForTimeout(400);
  }
  const after = await mem();
  expect(after.geometries).toBeLessThanOrEqual(base.geometries);
  expect(after.textures).toBeLessThanOrEqual(base.textures);
});
