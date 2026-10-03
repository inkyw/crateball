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
});
