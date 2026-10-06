import { loadModel, EMBEDDING_MODEL } from './modelManager';
import { getLocalAICapabilities } from './capabilityService';

export async function embedText(
  text: string,
  opts?: any
): Promise<{ success: boolean; vector?: number[]; error?: string; durationMs?: number; fallback?: boolean }> {
  const start = Date.now();
  try {
    const caps = await getLocalAICapabilities();
    if (!caps.localAI) {
      return { success: false, fallback: true, error: 'Local AI capabilities not available', durationMs: Date.now() - start };
    }

    const model = await loadModel('feature-extraction', EMBEDDING_MODEL);
    if (!model || model?.error) {
      return { success: false, fallback: true, error: model?.error || 'Failed to load embedding model', durationMs: Date.now() - start };
    }

    const options = { pooling: 'mean', normalize: true, ...(opts || {}) };
    const output = await model(text, options);

    let vector: number[] = [];
    if (output && Array.isArray(output)) {
      const first = output[0];
      if (first && typeof first.data !== 'undefined') {
        vector = Array.from(first.data);
      } else if (Array.isArray(first)) {
        vector = first;
      }
    } else if (output?.data) {
      vector = Array.from(output.data);
    }

    return { success: true, vector, durationMs: Date.now() - start };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Unknown embedding error', durationMs: Date.now() - start, fallback: true };
  }
}

export async function embedTexts(
  texts: string[]
): Promise<{ success: boolean; vectors?: number[][]; error?: string }> {
  try {
    const vectors: number[][] = [];
    for (let i = 0; i < texts.length; i++) {
      try {
        const result = await embedText(texts[i]);
        if (result.success && result.vector) {
          vectors.push(result.vector);
        } else {
          vectors.push([]);
        }
      } catch {
        vectors.push([]);
      }
    }
    const hasAny = vectors.some((v) => v.length > 0);
    return { success: hasAny, vectors };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Unknown batch embedding error' };
  }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  try {
    if (!a || !b || a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      const va = a[i] || 0;
      const vb = b[i] || 0;
      dot += va * vb;
      normA += va * va;
      normB += vb * vb;
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    if (denom === 0) return 0;
    return dot / denom;
  } catch {
    return 0;
  }
}

export async function rankBySimilarity(
  query: string,
  items: Array<{ id: string; text: string }>
): Promise<{ success: boolean; ranked?: Array<{ id: string; score: number; rank: number }>; error?: string }> {
  try {
    const queryResult = await embedText(query);
    if (!queryResult.success || !queryResult.vector) {
      return { success: false, error: queryResult.error || 'Failed to embed query' };
    }

    const scored: Array<{ id: string; score: number }> = [];
    for (const item of items) {
      try {
        const itemResult = await embedText(item.text);
        if (itemResult.success && itemResult.vector) {
          const score = cosineSimilarity(queryResult.vector, itemResult.vector);
          scored.push({ id: item.id, score });
        }
      } catch {
      }
    }

    scored.sort((a, b) => b.score - a.score);
    const ranked = scored.map((s, idx) => ({ ...s, rank: idx + 1 }));

    return { success: true, ranked };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Unknown ranking error' };
  }
}
