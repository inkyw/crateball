export type Command = (...args: unknown[]) => unknown;

/** window.__game: Playwright ve Claude in Chrome oyunu bununla okur ve yönetir (sadece dev build). */
export interface DebugBridge {
  readonly version: 1;
  getState(): unknown;
  cmd(name: string, ...args: unknown[]): unknown;
  commands(): string[];
  register(name: string, fn: Command): void;
}

export function createDebugBridge(getState: () => unknown): DebugBridge {
  const registry = new Map<string, Command>([['ping', () => 'pong']]);
  const names = () => [...registry.keys()].sort();
  return {
    version: 1,
    getState,
    commands: names,
    register(name, fn) {
      if (registry.has(name)) throw new Error(`Command already registered: ${name}`);
      registry.set(name, fn);
    },
    cmd(name, ...args) {
      const fn = registry.get(name);
      if (!fn) throw new Error(`Unknown command: ${name}. Available: ${names().join(', ')}`);
      return fn(...args);
    },
  };
}
