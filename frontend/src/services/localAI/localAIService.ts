import { isWebGPUSupported, getLocalAICapabilities } from './capabilityService';
import {
  loadModel,
  releaseModel,
  releaseAllModels,
  getCachedModelNames,
  EMBEDDING_MODEL,
  CLASSIFICATION_MODEL,
  ZERO_SHOT_MODEL,
} from './modelManager';
import { embedText, embedTexts, cosineSimilarity, rankBySimilarity } from './embeddingService';
import { classifyIntent, classifyCategory, detectSentiment, classifyTaskPriority } from './classificationService';

export const capabilities = {
  isWebGPUSupported,
  getLocalAICapabilities,
};

export const models = {
  loadModel,
  releaseModel,
  releaseAllModels,
  getCachedModelNames,
  EMBEDDING_MODEL,
  CLASSIFICATION_MODEL,
  ZERO_SHOT_MODEL,
};

export const embeddings = {
  embedText,
  embedTexts,
  cosineSimilarity,
  rankBySimilarity,
};

export const classification = {
  classifyIntent,
  classifyCategory,
  detectSentiment,
  classifyTaskPriority,
};

export async function healthcheck(): Promise<{ ok: boolean; status: string; features: Record<string, boolean> }> {
  try {
    const caps = await getLocalAICapabilities();
    const features: Record<string, boolean> = {
      webgpu: caps.webgpu,
      embeddings: caps.localAI,
      classification: caps.localAI,
      wasm: caps.wasm,
    };
    const allOk = caps.localAI;
    return {
      ok: allOk,
      status: allOk ? 'ready' : caps.wasm ? 'degraded' : 'unavailable',
      features,
    };
  } catch {
    return {
      ok: false,
      status: 'unavailable',
      features: { webgpu: false, embeddings: false, classification: false, wasm: false },
    };
  }
}

export async function prewarmEmbeddings(): Promise<void> {
  try {
    await embedText('hello');
  } catch {
  }
}

// Named re-export so useLocalAIStore can import it directly by name
export { getLocalAICapabilities };

const localAIService = {
  capabilities,
  models,
  embeddings,
  classification,
  healthcheck,
  prewarmEmbeddings,
};

export default localAIService;
