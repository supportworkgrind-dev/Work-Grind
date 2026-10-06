import { getLocalAICapabilities, getPreferredRuntime } from './capabilityService';

const modelCache = new Map<string, any>();

export const EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2';
export const CLASSIFICATION_MODEL = 'Xenova/distilbert-base-uncased-finetuned-sst-2-english';
export const ZERO_SHOT_MODEL = 'Xenova/mobilebert-uncased-mnli';

let envInitialized = false;

export function initEnv(): void {
  if (typeof window === 'undefined') return;
  if (envInitialized) return;

  try {
    import('@xenova/transformers').then(({ env }) => {
      try {
        env.allowLocalModels = false;
        env.allowRemoteModels = true;
        env.useBrowserCache = true;
        env.backends = env.backends ?? {} as any;
        env.backends.onnx = env.backends.onnx ?? {} as any;
        env.backends.onnx.wasm = env.backends.onnx.wasm ?? {} as any;
        env.backends.onnx.wasm.numThreads = 1;
        env.backends.onnx.wasm.simd = true;
      } catch {
      } finally {
        envInitialized = true;
      }
    }).catch(() => {
      envInitialized = true;
    });
  } catch {
  }
  envInitialized = true;
}

function resolveRuntime(): 'webgpu' | 'wasm' | 'cpu' {
  const caps = getPreferredRuntime();
  return caps === 'webgpu' ? 'webgpu' : caps === 'wasm' ? 'wasm' : 'cpu';
}

export async function loadModel(
  task: 'feature-extraction' | 'text-classification' | 'zero-shot-classification',
  modelName: string,
  options?: any
): Promise<any> {
  if (typeof window === 'undefined') {
    return { error: 'loadModel: server environment — model loading unavailable' };
  }

  try {
    const cacheKey = `${task}:${modelName}`;
    if (modelCache.has(cacheKey)) {
      return modelCache.get(cacheKey);
    }

    initEnv();

    const caps = await getLocalAICapabilities();
    const runtime = caps.webgpu ? 'webgpu' : caps.wasm ? 'wasm' : 'cpu';
    const { pipeline, env } = await import('@xenova/transformers');

    env.allowLocalModels = false;
    env.allowRemoteModels = true;
    env.useBrowserCache = true;
    env.backends = env.backends ?? ({} as any);
    env.backends.onnx = env.backends.onnx ?? ({} as any);
    env.backends.onnx.wasm = env.backends.onnx.wasm ?? ({} as any);
    env.backends.onnx.wasm.numThreads = 1;
    env.backends.onnx.wasm.simd = true;

    const timeout = new Promise<{ error: string }>((resolve) => {
      setTimeout(() => resolve({ error: `Model load timed out after 60s: ${modelName}` }), 60000);
    });

    const loadPromise = (async () => {
      try {
        const defaultOptions: any = {
          quantized: true,
          device: runtime,
          ...(options || {}),
        };
        const model = await pipeline(task, modelName, defaultOptions);
        modelCache.set(cacheKey, model);
        return model;
      } catch (err: any) {
        try {
          const fallbackModel = await pipeline(task, modelName, {
            ...(options || {}),
            quantized: true,
            device: runtime === 'webgpu' ? 'wasm' : 'cpu',
          });
          modelCache.set(cacheKey, fallbackModel);
          return fallbackModel;
        } catch (fallbackErr: any) {
          return { error: fallbackErr?.message || err?.message || `Failed to load model: ${modelName}` };
        }
      }
    })();

    return await Promise.race([loadPromise, timeout]);
  } catch (err: any) {
    return { error: err?.message || `Unexpected error loading model: ${modelName}` };
  }
}

export async function releaseModel(modelName: string): Promise<void> {
  try {
    const tasks: Array<'feature-extraction' | 'text-classification' | 'zero-shot-classification'> = [
      'feature-extraction',
      'text-classification',
      'zero-shot-classification',
    ];
    for (const task of tasks) {
      const cacheKey = `${task}:${modelName}`;
      const model = modelCache.get(cacheKey);
      if (model) {
        try {
          if (typeof model.dispose === 'function') {
            await model.dispose();
          }
        } catch {
        }
        modelCache.delete(cacheKey);
      }
    }
  } catch {
  }
}

export async function releaseAllModels(): Promise<void> {
  try {
    const keys = Array.from(modelCache.keys());
    for (const key of keys) {
      const model = modelCache.get(key);
      if (model && typeof model.dispose === 'function') {
        try {
          await model.dispose();
        } catch {
        }
      }
    }
    modelCache.clear();
  } catch {
  }
}

export function getCachedModelNames(): string[] {
  try {
    const keys = Array.from(modelCache.keys());
    return keys.map((k) => k.split(':').slice(1).join(':'));
  } catch {
    return [];
  }
}
