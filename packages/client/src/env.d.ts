/// <reference types="vite/client" />
import type { DebugBridge } from '@crateball/devtools';

declare global {
  /** Release this client was built from ('dev' in development). */
  const __APP_VERSION__: string;
  interface Window {
    __game?: DebugBridge;
  }
}

export {};
