/// <reference types="vite/client" />
import type { DebugBridge } from '@crateball/devtools';

declare global {
  interface Window {
    __game?: DebugBridge;
  }
}

export {};
