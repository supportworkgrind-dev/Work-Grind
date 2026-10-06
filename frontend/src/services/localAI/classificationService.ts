import { loadModel, ZERO_SHOT_MODEL } from './modelManager';
import { getLocalAICapabilities } from './capabilityService';

export const SEARCH_INTENTS = [
  'crm_lookup',
  'task_lookup',
  'meeting_lookup',
  'project_lookup',
  'message_lookup',
  'document_lookup',
  'team_lookup',
  'general_workspace',
];

export const CATEGORIES = ['urgent', 'question', 'request', 'idea', 'issue', 'update', 'followup'];

export const SENTIMENT_LABELS = ['positive', 'negative', 'neutral'];

async function runZeroShot(
  text: string,
  labels: string[]
): Promise<{ success: boolean; label?: string; scores?: Record<string, number>; error?: string }> {
  try {
    const caps = await getLocalAICapabilities();
    if (!caps.localAI) {
      return { success: false, error: 'Local AI not available' };
    }

    const model = await loadModel('zero-shot-classification', ZERO_SHOT_MODEL);
    if (!model || model?.error) {
      return { success: false, error: model?.error || 'Failed to load zero-shot model' };
    }

    const result = await model(text, labels);
    if (!result || !result.labels || !result.scores) {
      return { success: false, error: 'Invalid zero-shot result' };
    }

    const scores: Record<string, number> = {};
    for (let i = 0; i < result.labels.length; i++) {
      scores[result.labels[i]] = result.scores[i];
    }

    const bestLabel = result.labels[0];
    return { success: true, label: bestLabel, scores };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Zero-shot classification failed' };
  }
}

function ruleBasedIntent(query: string, labels: string[]): { intent: string; scores: Record<string, number> } {
  const q = query.toLowerCase();
  const scores: Record<string, number> = {};
  for (const label of labels) {
    scores[label] = 0;
  }

  if (q.match(/\bcrm\b|\bdeal\b|\bcontact\b|\bclient\b|\bcustomer\b|\blead\b/)) {
    scores['crm_lookup'] = (scores['crm_lookup'] || 0) + 0.9;
  }
  if (q.match(/\btask\b|\btodo\b|\bto-do\b|\bto do\b|\bchecklist\b/)) {
    scores['task_lookup'] = (scores['task_lookup'] || 0) + 0.9;
  }
  if (q.match(/\bmeeting\b|\bcall\b|\bschedule\b|\bcalendar\b|\bevent\b|\bappointment\b/)) {
    scores['meeting_lookup'] = (scores['meeting_lookup'] || 0) + 0.9;
  }
  if (q.match(/\bproject\b|\bsprint\b|\bepic\b|\bstory\b|\bboard\b/)) {
    scores['project_lookup'] = (scores['project_lookup'] || 0) + 0.9;
  }
  if (q.match(/\bmessage\b|\bchat\b|\bdm\b|\bthread\b|\bconversation\b/)) {
    scores['message_lookup'] = (scores['message_lookup'] || 0) + 0.9;
  }
  if (q.match(/\bdocument\b|\bdoc\b|\bfile\b|\battachment\b/)) {
    scores['document_lookup'] = (scores['document_lookup'] || 0) + 0.9;
  }
  if (q.match(/\bteam\b|\bmember\b|\bcolleague\b|\bpeople\b|\buser\b/)) {
    scores['team_lookup'] = (scores['team_lookup'] || 0) + 0.9;
  }

  let best = 'general_workspace';
  let bestScore = scores['general_workspace'] || 0.1;
  scores['general_workspace'] = bestScore;

  for (const label of labels) {
    if ((scores[label] || 0) > bestScore) {
      bestScore = scores[label];
      best = label;
    }
  }

  return { intent: best, scores };
}

function ruleBasedCategory(text: string): { category: string; scores: Record<string, number> } {
  const t = text.toLowerCase();
  const scores: Record<string, number> = {};
  for (const cat of CATEGORIES) {
    scores[cat] = 0;
  }

  if (t.match(/\burgent\b|\basap\b|\bemergency\b|\bcritical\b|\bblocker\b|🔥|p0|p1/)) {
    scores['urgent'] = 0.9;
  }
  if (t.includes('?') || t.match(/\bwhat\b|\bhow\b|\bwhy\b|\bwhen\b|\bwhere\b|\bcan you\b|\bdoes\b|\bis\b/)) {
    scores['question'] = 0.85;
  }
  if (t.match(/\bplease\b|\bcan you\b|\bcould you\b|\bneed\b|\brequest\b/)) {
    scores['request'] = 0.8;
  }
  if (t.match(/\bidea\b|\bsuggest\b|\bmaybe\b|\bwhat if\b|\bproposal\b/)) {
    scores['idea'] = 0.8;
  }
  if (t.match(/\bbug\b|\bfail\b|\bcrash\b|\bissue\b|\bwrong\b|\bproblem\b/)) {
    scores['issue'] = 0.85;
  }
  if (t.match(/\bupdate\b|\bstatus\b|\bprogress\b|\bcompleted\b|\bdone\b|\bfyi\b/)) {
    scores['update'] = 0.8;
  }
  if (t.match(/\bfollow\s?up\b|\bfollowup\b|\bremind\b|\bcheck in\b/)) {
    scores['followup'] = 0.8;
  }

  let best = 'update';
  let bestScore = 0;
  for (const cat of CATEGORIES) {
    if ((scores[cat] || 0) > bestScore) {
      bestScore = scores[cat];
      best = cat;
    }
  }
  if (bestScore === 0) {
    scores['update'] = 0.5;
    bestScore = 0.5;
  }

  return { category: best, scores };
}

function ruleBasedSentiment(text: string): { sentiment: 'positive' | 'negative' | 'neutral'; score: number } {
  const t = text.toLowerCase();
  const positiveWords = ['great', 'excellent', 'thanks', 'thank', 'love', 'perfect', 'awesome', 'amazing', 'wonderful', 'good', 'happy', 'excited', '✓', '🎉', '👍', '💯', '✅', '🚀'];
  const negativeWords = ['bug', 'fail', 'failed', 'crash', 'issue', 'wrong', 'broken', 'blocked', 'late', 'overdue', 'missing', 'angry', 'bad', 'terrible', 'awful', 'hate', 'stuck', '😠', '😡', 'urgent'];

  let posCount = 0;
  let negCount = 0;

  for (const word of positiveWords) {
    const re = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
    const matches = t.match(re);
    if (matches) posCount += matches.length;
  }

  for (const word of negativeWords) {
    const re = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
    const matches = t.match(re);
    if (matches) negCount += matches.length;
  }

  if (posCount === 0 && negCount === 0) {
    return { sentiment: 'neutral', score: 0.5 };
  }

  const total = posCount + negCount;
  const posRatio = posCount / total;

  if (posRatio > 0.65) {
    return { sentiment: 'positive', score: 0.5 + posRatio * 0.4 };
  } else if (posRatio < 0.35) {
    return { sentiment: 'negative', score: 0.5 + (1 - posRatio) * 0.4 };
  } else {
    return { sentiment: 'neutral', score: 0.55 };
  }
}

export async function classifyIntent(
  query: string,
  labelsOverride?: string[]
): Promise<{ success: boolean; intent?: string; scores?: Record<string, number>; error?: string; fallback?: boolean }> {
  try {
    const labels = labelsOverride && labelsOverride.length > 0 ? labelsOverride : SEARCH_INTENTS;

    const zeroResult = await runZeroShot(query, labels);
    if (zeroResult.success && zeroResult.label) {
      return {
        success: true,
        intent: zeroResult.label,
        scores: zeroResult.scores,
        fallback: false,
      };
    }

    const fallback = ruleBasedIntent(query, labels);
    return {
      success: true,
      intent: fallback.intent,
      scores: fallback.scores,
      fallback: true,
      error: zeroResult.error,
    };
  } catch (err: any) {
    const labels = labelsOverride && labelsOverride.length > 0 ? labelsOverride : SEARCH_INTENTS;
    const fallback = ruleBasedIntent(query, labels);
    return {
      success: true,
      intent: fallback.intent,
      scores: fallback.scores,
      fallback: true,
      error: err?.message || 'Intent classification failed',
    };
  }
}

export async function classifyCategory(
  text: string
): Promise<{ success: boolean; category?: string; scores?: Record<string, number>; fallback?: boolean; error?: string }> {
  try {
    const zeroResult = await runZeroShot(text, CATEGORIES);
    if (zeroResult.success && zeroResult.label) {
      return {
        success: true,
        category: zeroResult.label,
        scores: zeroResult.scores,
        fallback: false,
      };
    }

    const fallback = ruleBasedCategory(text);
    return {
      success: true,
      category: fallback.category,
      scores: fallback.scores,
      fallback: true,
      error: zeroResult.error,
    };
  } catch (err: any) {
    const fallback = ruleBasedCategory(text);
    return {
      success: true,
      category: fallback.category,
      scores: fallback.scores,
      fallback: true,
      error: err?.message || 'Category classification failed',
    };
  }
}

export async function detectSentiment(
  text: string
): Promise<{ success: boolean; sentiment?: 'positive' | 'negative' | 'neutral'; score?: number; fallback?: boolean; error?: string }> {
  try {
    const zeroResult = await runZeroShot(text, SENTIMENT_LABELS);
    if (zeroResult.success && zeroResult.label && zeroResult.scores) {
      const sent = zeroResult.label as 'positive' | 'negative' | 'neutral';
      const sc = zeroResult.scores[zeroResult.label] || 0.5;
      return {
        success: true,
        sentiment: sent,
        score: sc,
        fallback: false,
      };
    }

    const fb = ruleBasedSentiment(text);
    return {
      success: true,
      sentiment: fb.sentiment,
      score: fb.score,
      fallback: true,
      error: zeroResult.error,
    };
  } catch (err: any) {
    const fb = ruleBasedSentiment(text);
    return {
      success: true,
      sentiment: fb.sentiment,
      score: fb.score,
      fallback: true,
      error: err?.message || 'Sentiment detection failed',
    };
  }
}

export async function classifyTaskPriority(text: string): Promise<'urgent' | 'high' | 'medium' | 'low'> {
  try {
    const t = text.toLowerCase();
    if (t.match(/\basap\b|\bcritical\b|\bemergency\b|\bblocker\b|\bp0\b|🔥|\burgent\b|\bnow\b|\bimmediately\b|\bimmediate\b/)) {
      return 'urgent';
    }
    if (t.match(/\bhigh priority\b|\bimportant\b|\bsoon\b|\bdeadline\b|\bp1\b|\bhigh\b.*\bpriority\b|\bmust have\b/)) {
      return 'high';
    }
    if (t.match(/\blow\b|\bnot important\b|\bwhenever\b|\bnice to have\b|\beventually\b|\bp3\b|\blow priority\b|\boptional\b/)) {
      return 'low';
    }
    return 'medium';
  } catch {
    return 'medium';
  }
}
