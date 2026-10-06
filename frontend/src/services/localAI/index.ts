export {
  default,
  capabilities,
  models,
  embeddings,
  classification,
  healthcheck,
  prewarmEmbeddings,
} from './localAIService';

export { isWebGPUSupported, getLocalAICapabilities } from './capabilityService';
export {
  loadModel,
  releaseModel,
  releaseAllModels,
  getCachedModelNames,
  EMBEDDING_MODEL,
  CLASSIFICATION_MODEL,
  ZERO_SHOT_MODEL,
  initEnv,
} from './modelManager';

// Synchronous (main-thread) embedding service
export { embedText, embedTexts, cosineSimilarity, rankBySimilarity } from './embeddingService';

// Worker-backed embedding service (preferred — off main thread)
export {
  embedText  as workerEmbedText,
  embedTexts as workerEmbedTexts,
  rankBySimilarity as workerRankBySimilarity,
  releaseWorker,
  isWorkerReady,
} from './workerEmbeddingService';

export {
  classifyIntent,
  classifyCategory,
  detectSentiment,
  classifyTaskPriority,
  SEARCH_INTENTS,
  CATEGORIES,
  SENTIMENT_LABELS,
} from './classificationService';
