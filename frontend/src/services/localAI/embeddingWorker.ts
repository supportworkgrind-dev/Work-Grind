/**
 * embeddingWorker.ts
 *
 * Runs @xenova/transformers feature-extraction entirely in a Web Worker
 * so embedding computation never blocks the main thread / UI.
 *
 * USAGE (from main thread):
 *   const worker = new Worker(
 *     new URL('./embeddingWorker.ts', import.meta.url),
 *     { type: 'module' }
 *   );
 *   worker.postMessage({ id: '1', type: 'embed', text: 'hello world' });
 *   worker.onmessage = ({ data }) => { if (data.id === '1') console.log(data.vector); };
 *
 * MESSAGE PROTOCOL
 * ─────────────────
 * Inbound (main → worker):
 *   { id: string, type: 'embed',  text: string }
 *   { id: string, type: 'embeds', texts: string[] }
 *   { type: 'ping' }
 *
 * Outbound (worker → main):
 *   { id: string, type: 'embed',  vector: number[], durationMs: number }
 *   { id: string, type: 'embeds', vectors: number[][], durationMs: number }
 *   { id: string, type: 'error',  error: string }
 *   { type: 'ready' }
 *   { type: 'pong' }
 *
 * FALLBACK:
 *   If the pipeline fails to load or the browser doesn't support Workers,
 *   the main-thread embeddingService.ts is used as a fallback automatically.
 *   This worker is strictly an optimisation — never a hard dependency.
 */

// ── Types for the message protocol ───────────────────────────────────────────

type InboundMsg =
  | { id: string; type: 'embed';  text: string }
  | { id: string; type: 'embeds'; texts: string[] }
  | { type: 'ping' };

type OutboundMsg =
  | { id: string; type: 'embed';  vector:  number[]; durationMs: number }
  | { id: string; type: 'embeds'; vectors: number[][]; durationMs: number }
  | { id: string; type: 'error';  error: string }
  | { type: 'ready' }
  | { type: 'pong' };

// ── Model singleton inside the worker ─────────────────────────────────────────

const EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2';

// Lazily initialised so the model is only downloaded the first time an
// embedding is actually needed.
let pipeline: any = null;
let loadingPromise: Promise<void> | null = null;

async function getModel(): Promise<any> {
  if (pipeline) return pipeline;

  if (!loadingPromise) {
    loadingPromise = (async () => {
      try {
        const { pipeline: createPipeline, env } = await import('@xenova/transformers');

        env.allowLocalModels = false;
        env.allowRemoteModels = true;
        env.useBrowserCache = true;
        env.backends = env.backends ?? {} as any;
        env.backends.onnx = env.backends.onnx ?? {} as any;
        env.backends.onnx.wasm = env.backends.onnx.wasm ?? {} as any;
        env.backends.onnx.wasm.numThreads = 1;
        env.backends.onnx.wasm.simd = true;

        const runtime = typeof navigator !== 'undefined' && 'gpu' in navigator ? 'webgpu' : 'wasm';
        pipeline = await createPipeline('feature-extraction', EMBEDDING_MODEL, {
          quantized: true,
          device: runtime,
        } as any);
      } catch (err: any) {
        loadingPromise = null; // allow retry on next call
        throw err;
      }
    })();
  }

  await loadingPromise;
  return pipeline;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractVector(output: any): number[] {
  if (!output) return [];
  if (Array.isArray(output)) {
    const first = output[0];
    if (first?.data) return Array.from(first.data as ArrayLike<number>);
    if (Array.isArray(first)) return first as number[];
  }
  if (output.data) return Array.from(output.data as ArrayLike<number>);
  return [];
}

async function embedSingle(text: string): Promise<number[]> {
  const model = await getModel();
  const out   = await model(text, { pooling: 'mean', normalize: true });
  return extractVector(out);
}

// ── Message handler ───────────────────────────────────────────────────────────

self.onmessage = async (event: MessageEvent<InboundMsg>) => {
  const msg = event.data;

  if (msg.type === 'ping') {
    const reply: OutboundMsg = { type: 'pong' };
    self.postMessage(reply);
    return;
  }

  const start = Date.now();

  if (msg.type === 'embed') {
    try {
      const vector = await embedSingle(msg.text);
      const reply: OutboundMsg = { id: msg.id, type: 'embed', vector, durationMs: Date.now() - start };
      self.postMessage(reply);
    } catch (err: any) {
      const reply: OutboundMsg = { id: msg.id, type: 'error', error: err?.message ?? 'Worker embed failed' };
      self.postMessage(reply);
    }
    return;
  }

  if (msg.type === 'embeds') {
    try {
      const vectors: number[][] = [];
      for (const text of msg.texts) {
        try {
          vectors.push(await embedSingle(text));
        } catch {
          vectors.push([]); // empty vector for failed individual items
        }
      }
      const reply: OutboundMsg = { id: msg.id, type: 'embeds', vectors, durationMs: Date.now() - start };
      self.postMessage(reply);
    } catch (err: any) {
      const reply: OutboundMsg = { id: msg.id, type: 'error', error: err?.message ?? 'Worker embeds failed' };
      self.postMessage(reply);
    }
    return;
  }
};

// Signal that the worker script parsed and is ready to receive messages
const readyMsg: OutboundMsg = { type: 'ready' };
self.postMessage(readyMsg);

export {}; // makes TypeScript treat this as a module
