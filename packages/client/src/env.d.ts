/// <reference types="vite/client" />
import type { DebugBridge } from '@gg/devtools';

declare global {
  interface Window {
    __game?: DebugBridge;
  }
}

export {};
