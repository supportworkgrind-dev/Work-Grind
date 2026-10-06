'use client';

/**
 * useLocalAIStore
 *
 * Zustand store that tracks the state of the local AI layer
 * (Transformers.js + WebGPU capability detection).
 *
 * IMPORTANT — no static top-level import of localAI services here.
 * All localAI imports are done lazily inside the `initialize` action so that:
 *   1. The @xenova/transformers package is NEVER imported during SSR.
 *   2. Webpack does not trace the dynamic import during server compilation.
 *   3. The native `sharp` .node binary inside @xenova/transformers never
 *      enters the Next.js client or server bundle.
 *
 * The 'use client' directive ensures this module is only compiled for the
 * browser bundle, giving webpack the correct resolution conditions.
 */

import { create } from 'zustand';

type HealthStatus = 'ready' | 'degraded' | 'unavailable' | null;

type Capabilities = {
  webgpu: boolean;
  wasm: boolean;
  localAI: boolean;
  browser: string;
} | null;

interface LocalAIState {
  capabilities: Capabilities;
  isInitializing: boolean;
  activeModelCount: number;
  loadingModels: string[];
  errors: string[];
  lastHealth: HealthStatus;

  setCapabilities: (caps: Capabilities) => void;
  setInitializing: (b: boolean) => void;
  addLoadingModel: (name: string) => void;
  removeLoadingModel: (name: string) => void;
  setActiveModelCount: (n: number) => void;
  pushError: (msg: string) => void;
  setLastHealth: (h: HealthStatus) => void;
  reset: () => void;
  initialize: () => Promise<void>;
}

export const useLocalAIStore = create<LocalAIState>((set) => ({
  capabilities: null,
  isInitializing: false,
  activeModelCount: 0,
  loadingModels: [],
  errors: [],
  lastHealth: null,

  setCapabilities: (caps) => set({ capabilities: caps }),
  setInitializing: (b) => set({ isInitializing: b }),
  addLoadingModel: (name) =>
    set((state) => ({
      loadingModels: state.loadingModels.includes(name)
        ? state.loadingModels
        : [...state.loadingModels, name],
    })),
  removeLoadingModel: (name) =>
    set((state) => ({
      loadingModels: state.loadingModels.filter((m) => m !== name),
    })),
  setActiveModelCount: (n) => set({ activeModelCount: n }),
  pushError: (msg) => set((state) => ({ errors: [...state.errors, msg] })),
  setLastHealth: (h) => set({ lastHealth: h }),
  reset: () =>
    set({
      capabilities: null,
      isInitializing: false,
      activeModelCount: 0,
      loadingModels: [],
      errors: [],
      lastHealth: null,
    }),

  initialize: async () => {
    // Guard: never run on the server — this is a browser-only operation
    if (typeof window === 'undefined') return;

    try {
      set({ isInitializing: true });

      // Lazy dynamic import — only resolved in the browser, never during SSR.
      // This prevents @xenova/transformers (and its transitive native deps)
      // from entering the server or client Webpack bundle at build time.
      const { getLocalAICapabilities, healthcheck } = await import(
        '../services/localAI/localAIService'
      );

      const caps = await getLocalAICapabilities();
      set({ capabilities: caps });

      const health = await healthcheck();
      set({ lastHealth: health.status as 'ready' | 'degraded' | 'unavailable' });
    } catch (err: any) {
      set((state) => ({
        errors: [...state.errors, err?.message || 'Initialization failed'],
        lastHealth: 'unavailable',
      }));
    } finally {
      set({ isInitializing: false });
    }
  },
}));
