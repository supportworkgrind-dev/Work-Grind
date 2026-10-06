export type LocalModelRuntime = 'webgpu' | 'wasm' | 'cpu';

let cachedCapabilities: {
  webgpu: boolean;
  wasm: boolean;
  localAI: boolean;
  browser: string;
  runtime: LocalModelRuntime;
} | null = null;

function detectBrowser(): string {
  try {
    if (typeof navigator === 'undefined' || !navigator.userAgent) return 'other';
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('firefox')) return 'firefox';
    if (ua.includes('safari') && !ua.includes('chromium') && !ua.includes('chrome')) return 'safari';
    if (ua.includes('chrome') || ua.includes('chromium') || ua.includes('edge')) return 'chromium';
    return 'other';
  } catch {
    return 'other';
  }
}

export function getPreferredRuntime(): LocalModelRuntime {
  if (typeof navigator !== 'undefined' && 'gpu' in navigator && !!(navigator as any).gpu && typeof (navigator as any).gpu.requestAdapter === 'function') {
    return 'webgpu';
  }
  if (typeof WebAssembly !== 'undefined') {
    return 'wasm';
  }
  return 'cpu';
}

export function isTransformersSupported(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    if (typeof Worker === 'undefined') return false;
    const hasWebAssembly = typeof WebAssembly !== 'undefined';
    return hasWebAssembly && typeof Worker !== 'undefined';
  } catch {
    return false;
  }
}

export async function isWebGPUSupported(): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined') return false;
    if (!('gpu' in navigator) || !(navigator as any).gpu) return false;
    const gpu = (navigator as any).gpu;
    if (typeof gpu.requestAdapter !== 'function') return false;

    const timeout = new Promise<false>((resolve) => {
      setTimeout(() => resolve(false), 1000);
    });

    const adapterPromise = gpu.requestAdapter().then((adapter: any) => !!adapter).catch(() => false);
    return await Promise.race([adapterPromise, timeout]);
  } catch {
    return false;
  }
}

export async function getLocalAICapabilities(): Promise<{ webgpu: boolean; wasm: boolean; localAI: boolean; browser: string; runtime: LocalModelRuntime }> {
  if (cachedCapabilities) {
    return { ...cachedCapabilities };
  }

  try {
    const webgpu = await isWebGPUSupported();
    const wasm = typeof WebAssembly !== 'undefined';
    const transformers = isTransformersSupported();
    const browser = detectBrowser();
    const runtime = webgpu ? 'webgpu' : wasm ? 'wasm' : 'cpu';
    const localAI = wasm && transformers;

    cachedCapabilities = { webgpu, wasm, localAI, browser, runtime };
    return { ...cachedCapabilities };
  } catch {
    const fallback = { webgpu: false, wasm: false, localAI: false, browser: detectBrowser(), runtime: 'cpu' as const };
    cachedCapabilities = fallback;
    return { ...fallback };
  }
}
