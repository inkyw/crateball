export {};

declare global {
  interface Window {
    __game?: {
      getState(): unknown;
      cmd(name: string, ...args: unknown[]): unknown;
      commands(): string[];
    };
  }
}
