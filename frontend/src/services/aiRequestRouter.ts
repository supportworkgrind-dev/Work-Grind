'use client';

/**
 * aiRequestRouter.ts
 *
 * Decides whether an AI request should be handled locally (Transformers.js)
 * or routed to the WorkGrind backend (Gemini).
 *
 * ALL imports of localAI services are lazy (inside function bodies) so that
 * @xenova/transformers is NEVER included in the initial bundle or traced by
 * Webpack during SSR compilation.  The 'use client' directive ensures this
 * module is only compiled for browser builds.
 */

export type AIFeature =
  | 'semantic_search'
  | 'search_intent'
  | 'text_classification'
  | 'sentiment'
  | 'task_priority'
  | 'text_embedding'
  | 'similarity_ranking'
  | 'ai_chat'
  | 'ai_agent'
  | 'knowledge_qa'
  | 'meeting_summary'
  | 'document_summary'
  | 'daily_focus';

export type RoutingDecision = {
  feature: AIFeature;
  route: 'local' | 'backend';
  reason: string;
  confidence?: number;
  canProcessLocally: boolean;
};

const LOCAL_FEATURES: AIFeature[] = [
  'semantic_search',
  'search_intent',
  'text_classification',
  'sentiment',
  'task_priority',
  'text_embedding',
  'similarity_ranking',
];

const BACKEND_FEATURES: AIFeature[] = [
  'ai_chat',
  'ai_agent',
  'knowledge_qa',
  'meeting_summary',
  'document_summary',
  'daily_focus',
];

export async function decideRoute(
  feature: AIFeature,
  payload?: { query?: string; sizeBytes?: number; requiresGeneration?: boolean }
): Promise<RoutingDecision> {
  if (BACKEND_FEATURES.includes(feature)) {
    return {
      feature,
      route: 'backend',
      reason: 'Feature requires workspace data, complex reasoning, or generation capabilities',
      canProcessLocally: false,
    };
  }

  if (LOCAL_FEATURES.includes(feature)) {
    // Lazy import — only executed in the browser, never at module parse time
    const { getLocalAICapabilities } = await import('./localAI/capabilityService');
    const caps = await getLocalAICapabilities();
    if (caps.localAI) {
      return {
        feature,
        route: 'local',
        reason: 'Local AI capabilities available for lightweight inference',
        confidence: 0.9,
        canProcessLocally: true,
      };
    }
    return {
      feature,
      route: 'backend',
      reason: 'Local AI not supported in this environment; falling back to backend',
      canProcessLocally: false,
    };
  }

  return {
    feature,
    route: 'backend',
    reason: 'Unknown feature; defaulting to backend',
    canProcessLocally: false,
  };
}

export async function processLocalIfPossible(
  feature: AIFeature,
  input: any
): Promise<{
  success: boolean;
  result?: any;
  error?: string;
  wasLocal: boolean;
  usedFallback?: boolean;
}> {
  // Guard: never execute on server
  if (typeof window === 'undefined') {
    return { success: false, wasLocal: false, error: 'Server environment — local AI unavailable' };
  }

  try {
    switch (feature) {
      case 'search_intent': {
        // Lazy import of classification service
        const { classifyIntent } = await import('./localAI/classificationService');
        const result = await classifyIntent(input.query);
        return { success: true, result, wasLocal: true };
      }
      case 'text_classification': {
        const { classifyCategory } = await import('./localAI/classificationService');
        const result = await classifyCategory(input.text);
        return { success: true, result, wasLocal: true };
      }
      case 'sentiment': {
        const { detectSentiment } = await import('./localAI/classificationService');
        const result = await detectSentiment(input.text);
        return { success: true, result, wasLocal: true };
      }
      case 'task_priority': {
        const { classifyTaskPriority } = await import('./localAI/classificationService');
        const result = await classifyTaskPriority(input.text);
        return { success: true, result, wasLocal: true };
      }
      case 'text_embedding': {
        // Worker-backed: off main thread, falls back to sync automatically
        const { embedText } = await import('./localAI/workerEmbeddingService');
        const result = await embedText(input.text);
        return { success: result.success, result, wasLocal: true };
      }
      case 'similarity_ranking': {
        // Worker-backed ranking so UI never freezes during embedding
        const { rankBySimilarity } = await import('./localAI/workerEmbeddingService');
        const result = await rankBySimilarity(input.query, input.items);
        return { success: result.success, result, wasLocal: true };
      }
      case 'semantic_search': {
        if (input.query && input.items) {
          const { rankBySimilarity } = await import('./localAI/workerEmbeddingService');
          const result = await rankBySimilarity(input.query, input.items);
          return { success: result.success, result, wasLocal: true };
        }
        return { success: false, wasLocal: false, error: 'semantic_search requires query and items' };
      }
      default:
        return { success: false, wasLocal: false, error: `Feature ${feature} cannot be processed locally` };
    }
  } catch (err: any) {
    return {
      success: false,
      wasLocal: false,
      error: err?.message || 'Local processing failed',
      usedFallback: true,
    };
  }
}
