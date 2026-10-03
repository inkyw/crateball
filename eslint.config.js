import { builtinModules } from 'node:module';
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const WORKSPACE = ['@gg/sim', '@gg/protocol', '@gg/client', '@gg/server', '@gg/devtools'];
const NODE_BUILTINS = builtinModules.flatMap((m) => [m, `${m}/*`]);
// Gitignore tarzı desenler './net' gibi göreli yolları 'net' sanır; göreli yolları hariç tut.
const RELATIVE_OK = ['!./*', '!../*', '!./**', '!../**'];
const restrict = (group, message) => ['error', { patterns: [{ group, message }] }];

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      'prototypes/**',
      'logs/**',
      'test-results/**',
      'playwright-report/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { languageOptions: { globals: { ...globals.node } } },
  {
    files: ['packages/client/**', 'packages/devtools/**', 'tests/e2e/**', 'tests/e2e-prod/**'],
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    files: ['packages/sim/src/**/*.ts'],
    rules: {
      'no-restricted-imports': restrict(
        ['three', 'three/*', 'ws', 'node:*', ...NODE_BUILTINS, ...WORKSPACE],
        'sim saf kalmalı: ekran, ağ, Node ve diğer paketlere bağımlı olamaz.',
      ),
      'no-restricted-syntax': [
        'error',
        { selector: 'ImportExpression', message: 'sim dinamik import kullanamaz.' },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'sim deterministik olmalı: createRng(seed) kullan.' },
        { object: 'globalThis', property: 'Math', message: 'sim globalThis üzerinden Math kullanamaz.' },
        {
          object: 'globalThis',
          property: 'Date',
          message: 'sim duvar saatine erişemez; tick sayacını kullan.',
        },
        { object: 'globalThis', property: 'performance', message: 'sim duvar saatine erişemez.' },
      ],
      'no-restricted-globals': ['error', 'window', 'document', 'performance', 'Date'],
    },
  },
  {
    files: ['packages/protocol/src/**/*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@gg/sim',
              message: "protocol @gg/sim'den sadece tip alabilir (import type).",
              allowTypeImports: true,
            },
          ],
          patterns: [
            {
              group: [
                'three',
                'three/*',
                'ws',
                'node:*',
                ...NODE_BUILTINS,
                ...RELATIVE_OK,
                ...WORKSPACE.filter((p) => p !== '@gg/sim'),
              ],
              message: 'protocol sadece @gg/sim tiplerine bağlı olabilir.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/client/src/**/*.ts'],
    rules: {
      'no-restricted-imports': restrict(
        ['@gg/server', 'ws', 'node:*', ...NODE_BUILTINS, ...RELATIVE_OK],
        'client sunucu koduna ve Node modüllerine bağlanamaz.',
      ),
    },
  },
  {
    files: ['packages/server/src/**/*.ts'],
    rules: {
      'no-restricted-imports': restrict(
        ['@gg/client', 'three', 'three/*'],
        'server render koduna bağlanamaz.',
      ),
    },
  },
  {
    files: ['packages/devtools/src/**/*.ts'],
    rules: {
      'no-restricted-imports': restrict(
        ['@gg/server', '@gg/client', 'node:*', ...NODE_BUILTINS, ...RELATIVE_OK],
        'devtools client/server içine takılır, onlara ve Node modüllerine bağımlı olmaz.',
      ),
    },
  },
);
