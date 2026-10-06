/**
 * workerEmbeddingService.ts
 *
 * Main-thread wrapper around embeddingWorker.ts.
 *
 * - Lazily creates the Worker on first use (never on page load).
 * - Sends embedding jobs to the Worker and resolves them via a pending-map.
 * - Falls back silently to the synchronous embeddingService.ts if:
 *     • Workers are unavailable (SSR, old browsers)
 *     • Worker construction throws
 *     • A specific job times out (10 s)
 *
 * Exported surface is intentionally identical to embeddingService.ts so
 * consumers can swap between them without changing call sites.
 */

import { embedText as syncEmbedText, embedTexts as syncEmbedTexts, cosineSimilarity, rankBySimilarity as syncRankBySimilarity } from './embeddingService';

// ── Worker singleton ──────────────────────────────────────────────────────────

let _worker:  Worker   | null = null;
let _workerReady = false;
const _pending = new Map<string, { resolve: (v: number[]) => void; reject: (e: Error) => void; timeoutId: ReturnType<typeof setTimeout> }>();
const _pendingBatch = new Map<string, { resolve: (v: number[][]) => void; reject: (e: Error) => void; timeoutId: ReturnType<typeof setTimeout> }>();

const JOB_TIMEOUT_MS = 10_000; // 10 s per embedding job
let _idCounter = 0;

function nextId(): string {
  return `emb_${++_idCounter}_${Date.now()}`;
}

function isWorkerSupported(): boolean {
  return (
    typeof window   !== 'undefined' &&
    typeof Worker   !== 'undefined' &&
    typeof WebAssembly !== 'undefined'
  );
}

/**
 * Lazily create and return the Worker singleton.
 * Returns null if Workers are not supported or construction fails.
 */
function getWorker(): Worker | null {
  if (_worker) return _worker;
  if (!isWorkerSupported()) return null;

  try {
    _worker = new Worker(
      // Next.js / webpack will bundle this as a separate chunk
      new URL('./embeddingWorker.ts', import.meta.url),
      { type: 'module' },
    );

    _worker.onmessage = (event: MessageEvent) => {
      const data = event.data;

      if (data.type === 'ready') {
        _workerReady = true;
        return;
      }

      if (data.type === 'pong') return;

      if (data.type === 'embed' && data.id) {
        const job = _pending.get(data.id);
        if (job) {
          clearTimeout(job.timeoutId);
          _pending.delete(data.id);
          job.resolve(Array.isArray(data.vector) ? data.vector : []);
        }
        return;
      }

      if (data.type === 'embeds' && data.id) {
        const job = _pendingBatch.get(data.id);
        if (job) {
          clearTimeout(job.timeoutId);
          _pendingBatch.delete(data.id);
          job.resolve(Array.isArray(data.vectors) ? data.vectors : []);
        }
        return;
      }

      if (data.type === 'error' && data.id) {
        // Could be single or batch
        const single = _pending.get(data.id);
        if (single) {
          clearTimeout(single.timeoutId);
          _pending.delete(data.id);
          single.reject(new Error(data.error ?? 'Worker error'));
          return;
        }
        const batch = _pendingBatch.get(data.id);
        if (batch) {
          clearTimeout(batch.timeoutId);
          _pendingBatch.delete(data.id);
          batch.reject(new Error(data.error ?? 'Worker error'));
        }
      }
    };

    _worker.onerror = (err) => {
      console.warn('[EmbeddingWorker] Worker error — falling back to sync.', err);
      // Reject all pending jobs so they fall back.
      // Use Array.from to avoid --downlevelIteration requirement on Map iteration.
      Array.from(_pending.entries()).forEach(([id, job]) => {
        clearTimeout(job.timeoutId);
        job.reject(new Error('Worker crashed'));
        _pending.delete(id);
      });
      Array.from(_pendingBatch.entries()).forEach(([id, job]) => {
        clearTimeout(job.timeoutId);
        job.reject(new Error('Worker crashed'));
        _pendingBatch.delete(id);
      });
      _worker = null;
      _workerReady = false;
    };

    return _worker;
  } catch (err) {
    console.warn('[EmbeddingWorker] Could not create Worker — using sync fallback.', err);
    return null;
  }
}

// ── Public API (matches embeddingService.ts) ──────────────────────────────────

/**
 * Embed a single text string.
 * Runs in the Worker when available; falls back to sync service otherwise.
 */
export async function embedText(
  text: string,
): Promise<{ success: boolean; vector?: number[]; error?: string; durationMs?: number; fallback?: boolean }> {
  const start  = Date.now();
  const worker = getWorker();

  if (!worker) {
    // Synchronous fallback — no Worker support
    return syncEmbedText(text);
  }

  const id = nextId();

  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      _pending.delete(id);
      // Timeout: fall back to sync
      syncEmbedText(text).then(resolve);
    }, JOB_TIMEOUT_MS);

    _pending.set(id, {
      resolve: (vector) => resolve({ success: true, vector, durationMs: Date.now() - start }),
      reject:  (_err)   => syncEmbedText(text).then(resolve), // fallback on error
      timeoutId,
    });

    worker.postMessage({ id, type: 'embed', text });
  });
}

/**
 * Embed an array of text strings (batch).
 * Runs in the Worker when available; falls back to sync service otherwise.
 */
export async function embedTexts(
  texts: string[],
): Promise<{ success: boolean; vectors?: number[][]; error?: string }> {
  const worker = getWorker();

  if (!worker) {
    return syncEmbedTexts(texts);
  }

  const id = nextId();

  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      _pendingBatch.delete(id);
      syncEmbedTexts(texts).then(resolve);
    }, JOB_TIMEOUT_MS);

    _pendingBatch.set(id, {
      resolve: (vectors) => resolve({ success: true, vectors }),
      reject:  (_err)    => syncEmbedTexts(texts).then(resolve),
      timeoutId,
    });

    worker.postMessage({ id, type: 'embeds', texts });
  });
}

/** Re-export pure math helpers — no Worker needed */
export { cosineSimilarity };

/**
 * Rank items by semantic similarity to a query.
 * Uses the Worker-backed embedText under the hood.
 */
export async function rankBySimilarity(
  query: string,
  items: Array<{ id: string; text: string }>,
): Promise<{ success: boolean; ranked?: Array<{ id: string; score: number; rank: number }>; error?: string }> {
  try {
    const queryResult = await embedText(query);
    if (!queryResult.success || !queryResult.vector) {
      return { success: false, error: queryResult.error ?? 'Query embedding failed' };
    }

    const scored: Array<{ id: string; score: number }> = [];
    for (const item of items) {
      const itemResult = await embedText(item.text);
      if (itemResult.success && itemResult.vector) {
        scored.push({ id: item.id, score: cosineSimilarity(queryResult.vector, itemResult.vector) });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    return { success: true, ranked: scored.map((s, i) => ({ ...s, rank: i + 1 })) };
  } catch (err: any) {
    // Ultimate fallback to the sync version
    return syncRankBySimilarity(query, items);
  }
}

/**
 * Terminate the worker and release resources.
 * Call when the user navigates away from AI-heavy pages.
 */
export function releaseWorker(): void {
  if (_worker) {
    _worker.terminate();
    _worker = null;
    _workerReady = false;
  }
  _pending.clear();
  _pendingBatch.clear();
}

/** Returns true if a Worker is up and has signalled ready. */
export function isWorkerReady(): boolean {
  return !!_worker && _workerReady;
}
