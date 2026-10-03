import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../..', import.meta.url));
const eslint = new ESLint({ cwd: root });

async function ruleIds(code: string, filePath: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  return (result?.messages ?? []).map((m) => m.ruleId ?? 'parse-error');
}

describe('paket sınırları', () => {
  it('sim Math.random kullanamaz', async () => {
    expect(await ruleIds('export const x = Math.random();\n', 'packages/sim/src/fixture.ts')).toContain(
      'no-restricted-properties',
    );
  });
  it('sim Date kullanamaz', async () => {
    expect(await ruleIds('export const n = Date.now();\n', 'packages/sim/src/fixture.ts')).toContain(
      'no-restricted-globals',
    );
  });
  it('sim three içe aktaramaz', async () => {
    const code = "import * as T from 'three';\nexport const t = T;\n";
    expect(await ruleIds(code, 'packages/sim/src/fixture.ts')).toContain('no-restricted-imports');
  });
  it('client three kullanabilir', async () => {
    const code = "import * as T from 'three';\nexport const t = T;\n";
    expect(await ruleIds(code, 'packages/client/src/fixture.ts')).not.toContain('no-restricted-imports');
  });
  it('protocol client paketine bağlanamaz', async () => {
    const code = "import { x } from '@gg/client';\nexport const y = x;\n";
    expect(await ruleIds(code, 'packages/protocol/src/fixture.ts')).toContain(
      '@typescript-eslint/no-restricted-imports',
    );
  });
  it('sim önek olmadan Node modülü içe aktaramaz', async () => {
    const code = "import { readFileSync } from 'fs';\nexport const r = readFileSync;\n";
    expect(await ruleIds(code, 'packages/sim/src/fixture.ts')).toContain('no-restricted-imports');
  });
  it('sim dinamik import kullanamaz', async () => {
    expect(await ruleIds("export const m = import('three');\n", 'packages/sim/src/fixture.ts')).toContain(
      'no-restricted-syntax',
    );
  });
  it('sim globalThis.Date kullanamaz', async () => {
    expect(
      await ruleIds('export const n = globalThis.Date.now();\n', 'packages/sim/src/fixture.ts'),
    ).toContain('no-restricted-properties');
  });
  it("protocol @gg/sim'den çalışma zamanı değeri alamaz", async () => {
    const code = "import { createRng } from '@gg/sim';\nexport const r = createRng;\n";
    expect(await ruleIds(code, 'packages/protocol/src/fixture.ts')).toContain(
      '@typescript-eslint/no-restricted-imports',
    );
  });
  it("protocol @gg/sim'den tip alabilir", async () => {
    const code = "import type { Rng } from '@gg/sim';\nexport type R = Rng;\n";
    expect(await ruleIds(code, 'packages/protocol/src/fixture.ts')).not.toContain(
      '@typescript-eslint/no-restricted-imports',
    );
  });
  it('browser paketleri Node modülü içe aktaramaz', async () => {
    const code = "import { readFileSync } from 'fs';\nexport const r = readFileSync;\n";
    expect(await ruleIds(code, 'packages/client/src/fixture.ts')).toContain('no-restricted-imports');
    expect(await ruleIds(code, 'packages/devtools/src/fixture.ts')).toContain('no-restricted-imports');
    expect(await ruleIds(code, 'packages/protocol/src/fixture.ts')).toContain(
      '@typescript-eslint/no-restricted-imports',
    );
  });
  it('assets three kullanabilir', async () => {
    const code = "import * as T from 'three';\nexport const t = T;\n";
    expect(await ruleIds(code, 'packages/assets/src/fixture.ts')).toEqual([]);
  });
  it('assets three/addons kullanabilir', async () => {
    const code =
      "import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';\nexport const g = RoundedBoxGeometry;\n";
    expect(await ruleIds(code, 'packages/assets/src/fixture.ts')).toEqual([]);
  });
  it('assets @gg/sim veya Node modülü içe aktaramaz', async () => {
    expect(
      await ruleIds(
        "import { createRng } from '@gg/sim';\nexport const r = createRng;\n",
        'packages/assets/src/fixture.ts',
      ),
    ).toContain('no-restricted-imports');
    expect(
      await ruleIds(
        "import { readFileSync } from 'node:fs';\nexport const r = readFileSync;\n",
        'packages/assets/src/fixture.ts',
      ),
    ).toContain('no-restricted-imports');
  });
  it('sim @gg/assets içe aktaramaz', async () => {
    const code = "import { PAL } from '@gg/assets';\nexport const p = PAL;\n";
    expect(await ruleIds(code, 'packages/sim/src/fixture.ts')).toContain('no-restricted-imports');
  });
  it('client @gg/sim ve @gg/assets kullanabilir', async () => {
    const code =
      "import { SIM_TICK_HZ } from '@gg/sim';\nimport { ASSETS_PACKAGE } from '@gg/assets';\nexport const v = [SIM_TICK_HZ, ASSETS_PACKAGE];\n";
    expect(await ruleIds(code, 'packages/client/src/fixture.ts')).toEqual([]);
  });
  it('sim Node globallerini kullanamaz (process, Buffer, global, globalThis.process)', async () => {
    // typescript-eslint recommended TS dosyalarında no-undef'i kapatır; yasak hedefli kurallarla konur.
    expect(await ruleIds('export const p = process.env;\n', 'packages/sim/src/fixture.ts')).toContain(
      'no-restricted-globals',
    );
    expect(await ruleIds('export const b = Buffer.from("x");\n', 'packages/sim/src/fixture.ts')).toContain(
      'no-restricted-globals',
    );
    expect(await ruleIds('export const g = global;\n', 'packages/sim/src/fixture.ts')).toContain(
      'no-restricted-globals',
    );
    expect(await ruleIds('export const p = globalThis.process;\n', 'packages/sim/src/fixture.ts')).toContain(
      'no-restricted-properties',
    );
  });
  it('assets izin listesi: three ve paket içi göreli yollar serbest, başka her şey yasak', async () => {
    expect(
      await ruleIds(
        "import { PAL } from './palette';\nexport const p = PAL;\n",
        'packages/assets/src/fixture.ts',
      ),
    ).toEqual([]);
    expect(
      await ruleIds(
        "import { part } from '../src/geometry';\nexport const p = part;\n",
        'packages/assets/test/fixture.test.ts',
      ),
    ).toEqual([]);
    expect(
      await ruleIds("import _ from 'lodash';\nexport const l = _;\n", 'packages/assets/src/fixture.ts'),
    ).toContain('no-restricted-imports');
    expect(
      await ruleIds(
        "import { x } from '@gg/protocol';\nexport const y = x;\n",
        'packages/assets/src/fixture.ts',
      ),
    ).toContain('no-restricted-imports');
  });
});
