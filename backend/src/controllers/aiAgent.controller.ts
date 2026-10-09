import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { runAgentTurn, AIProviderUnavailableError } from '../ai/agentRuntime';
import { TOOLS } from '../ai/tools';
import AiConversation from '../models/AiConversation';
import { reserveAiRequest } from '../utils/planLimits';
import { recordUsage } from '../services/aiUsageTracker';
import { AI_REQUEST_TIMEOUT_MS, CLOUDFLARE_AI_MODEL, GEMINI_MODEL, OPENAI_MODEL, safeAIErrorLog } from '../services/geminiService';
import mongoose from 'mongoose';

const MAX_PROMPT_LENGTH = 12000;

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/ai/agent
// Run one agent turn (creates/continues a conversation)
// ═══════════════════════════════════════════════════════════════════════════════
export const runAgent = async (req: AuthRequest, res: Response): Promise<void> => {
  let streaming = false;
  const sendEvent = (event: string, data: unknown) => {
    if (res.destroyed || res.writableEnded) return;
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };
  try {
    const { message, conversationId } = req.body as {
      message:        string;
      conversationId?: string;
    };

    if (!message || typeof message !== 'string') {
      res.status(400).json({ success: false, message: 'message is required' });
      return;
    }

    const trimmed = message.trim();
    if (!trimmed) {
      res.status(400).json({ success: false, message: 'message cannot be empty' });
      return;
    }
    if (trimmed.length > MAX_PROMPT_LENGTH) {
      res.status(400).json({ success: false, message: `Message too long (max ${MAX_PROMPT_LENGTH} chars)` });
      return;
    }

    const companyId = req.user!.companyId ?? '';
    const userId    = req.user!.userId;

    const safeMessage = trimmed;

    // ── Plan-based AI limit check ─────────────────────────────────────────
    const limitCheck = await reserveAiRequest(userId);
    if (!limitCheck.allowed) {
      res.status(403).json({
        success:         false,
        message:         limitCheck.reason,
        code:            limitCheck.code,
        requiresUpgrade: limitCheck.upgrade ?? false,
      });
      return;
    }

    const userRole  = req.user!.role;
    const subscription = limitCheck.subscription;
    if (!subscription) throw new Error('Subscription data was not available after the AI limit check.');

    // ── Load or create conversation ───────────────────────────────────────
    let conversation = companyId && conversationId
      ? await AiConversation.findOne({
          _id:       conversationId,
          companyId: new mongoose.Types.ObjectId(companyId),
          userId:    new mongoose.Types.ObjectId(userId),
        })
      : null;

    if (companyId && !conversation) {
      conversation = await AiConversation.create({
        companyId: new mongoose.Types.ObjectId(companyId),
        userId:    new mongoose.Types.ObjectId(userId),
        title:     trimmed.slice(0, 80),
        messages:  [],
      });
    }

    // Build history from stored messages (user/assistant only)
    const storedHistory = conversation?.messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })) ?? [];
    const requestHistory = Array.isArray(req.body.history)
      ? req.body.history
          .filter((entry: any) => (entry?.role === 'user' || entry?.role === 'assistant') && typeof entry.content === 'string')
          .slice(-12)
          .map((entry: any) => ({ role: entry.role, content: entry.content.slice(-6000) }))
      : [];
    const history = storedHistory.length > 0 ? storedHistory : requestHistory;

    // ── Run the agent ─────────────────────────────────────────────────────
    const ctx = {
      companyId,
      userId,
      userRole,
      planName: subscription.planConfig.name,
      planId: subscription.plan,
      enabledFeatures: Object.entries(subscription.planConfig.entitlements)
        .filter(([, enabled]) => enabled)
        .map(([feature]) => feature),
      aiRequestsLimit: limitCheck.limit,
      aiRequestsUsed: limitCheck.current,
    };
    const agentStartTime = Date.now();
    const requestController = new AbortController();
    const requestTimeout = setTimeout(() => requestController.abort(), AI_REQUEST_TIMEOUT_MS);
    const abortIfDisconnected = () => {
      if (!res.writableEnded) requestController.abort();
    };
    if (req.body?.stream === true) {
      streaming = true;
      res.status(200).set({
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      res.flushHeaders();
      sendEvent('ready', { conversationId: conversation?._id.toString() ?? null });
      req.once('aborted', abortIfDisconnected);
      res.once('close', abortIfDisconnected);
    }
    let result;
    try {
      result = await runAgentTurn(safeMessage, history, ctx, {
        signal: requestController.signal,
        ...(streaming ? {
          onText: (text) => sendEvent('delta', { text }),
          onReset: () => sendEvent('reset', {}),
        } : {}),
      });
    } finally {
      clearTimeout(requestTimeout);
      req.off('aborted', abortIfDisconnected);
      res.off('close', abortIfDisconnected);
    }
    const durationMs = Date.now() - agentStartTime;

    // ── Persist messages ──────────────────────────────────────────────────
    if (conversation) {
      conversation.messages.push({ role: 'user', content: trimmed, createdAt: new Date() });
      for (const step of result.toolSteps) {
        conversation.messages.push({
          role:       'tool',
          content:    `Tool: ${step.toolName}`,
          toolName:   step.toolName,
          toolResult: JSON.stringify(step.toolResult),
          createdAt:  new Date(),
        });
      }
      conversation.messages.push({ role: 'assistant', content: result.reply, createdAt: new Date() });
      if (conversation.messages.length > 100) conversation.messages = conversation.messages.slice(-100);
      await conversation.save();
    }

    // ── Record AI usage ───────────────────────────────────────────────────
    try {
      if (!companyId) throw new Error('Workspace usage records require a company.');
      const agentSuccess = Boolean(result.reply);
      await recordUsage({
        companyId,
        userId,
        feature: 'ai_agent',
        provider: result.provider === 'fallback' ? 'fallback' : result.provider,
        modelName: result.provider === 'gemini' ? GEMINI_MODEL : result.provider === 'openai' ? OPENAI_MODEL : result.provider === 'cloudflare' ? CLOUDFLARE_AI_MODEL : 'identity_response',
        success: agentSuccess,
        durationMs,
        inputTokens: undefined,
        outputTokens: undefined,
      });
    } catch (_e) { /* ignore */ }

    const response = {
      success:        true,
      reply:          result.reply,
      provider:       result.provider,
      toolSteps:      result.toolSteps.map(s => ({
        toolName:   s.toolName,
        success:    s.toolResult.success,
        durationMs: s.durationMs,
        error:      s.toolResult.error,
      })),
      conversationId: conversation?._id.toString() ?? null,
      tokensUsed:     result.tokensUsed,
    };
    if (streaming) {
      sendEvent('done', {
        provider: response.provider,
        toolSteps: response.toolSteps,
        conversationId: response.conversationId,
        tokensUsed: response.tokensUsed,
      });
      res.end();
      return;
    }
    res.json(response);
  } catch (err: any) {
    const safeError = safeAIErrorLog(err);
    const providerFailure = err instanceof AIProviderUnavailableError;
    if (providerFailure) {
      console.error('[Tavro AI] request diagnostic', {
        provider: err.provider ?? 'none',
        model: err.model ?? 'none',
        status: err.statusCode,
        errorCategory: err.category,
        fallbackAttempted: err.fallbackAttempted,
        fallbackResult: err.fallbackResult,
      });
    } else {
      console.error('[Tavro AI] Request failed', safeError);
    }
    try {
      if (req.user?.companyId) {
        await recordUsage({
          companyId: req.user.companyId,
          userId: req.user.userId,
          feature: 'ai_agent',
          provider: 'fallback',
          modelName: 'provider_error',
          success: false,
          errorMessage: providerFailure ? `Provider failure: ${err.category}` : safeError.message,
        });
      }
    } catch (_e) { /* ignore */ }
    if (streaming && res.headersSent) {
      sendEvent('error', {
        code: providerFailure ? err.code : 'AI_AGENT_ERROR',
        message: providerFailure ? err.message : 'Tavro AI encountered an internal error. Please try again shortly.',
        ...(providerFailure ? {
          category: err.category,
          fallbackAttempted: err.fallbackAttempted,
          fallbackResult: err.fallbackResult,
        } : {}),
      });
      res.end();
      return;
    }
    res.status(providerFailure ? err.statusCode : 500).json({
      success: false,
      code: providerFailure ? err.code : 'AI_AGENT_ERROR',
      message: providerFailure ? err.message : 'Tavro AI encountered an internal error. Please try again shortly.',
      ...(providerFailure ? {
        provider: err.provider ?? null,
        category: err.category,
        fallbackAttempted: err.fallbackAttempted,
        fallbackResult: err.fallbackResult,
      } : {}),
    });
  }
};

/** Compatibility adapter for older chat clients that send `prompt` and expect `response`. */
export const chatWithTavro = async (req: AuthRequest, res: Response): Promise<void> => {
  const message = typeof req.body?.message === 'string' ? req.body.message : req.body?.prompt;
  req.body = { ...req.body, message };
  const originalJson = res.json.bind(res);
  res.json = ((payload: any) => originalJson({
    ...payload,
    ...(typeof payload?.reply === 'string' ? { response: payload.reply } : {}),
  })) as Response['json'];
  try {
    await runAgent(req, res);
  } finally {
    res.json = originalJson as Response['json'];
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/ai/agent/history
// List recent conversations for the authenticated user
// ═══════════════════════════════════════════════════════════════════════════════
export const getConversationHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const conversations = await AiConversation.find({
      companyId: req.user!.companyId,
      userId:    req.user!.userId,
    })
      .select('title createdAt updatedAt')
      .sort({ updatedAt: -1 })
      .limit(20)
      .lean();

    res.json({ success: true, conversations });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/ai/agent/conversations/:id
// Get messages for a specific conversation
// ═══════════════════════════════════════════════════════════════════════════════
export const getConversation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const conv = await AiConversation.findOne({
      _id:       req.params.id,
      companyId: req.user!.companyId,
      userId:    req.user!.userId,
    }).lean();

    if (!conv) {
      res.status(404).json({ success: false, message: 'Conversation not found' });
      return;
    }

    // Return only user/assistant messages to the frontend
    const messages = (conv.messages ?? [])
      .filter((m: any) => m.role === 'user' || m.role === 'assistant')
      .map((m: any) => ({ role: m.role, content: m.content, createdAt: m.createdAt }));

    res.json({ success: true, conversation: { ...conv, messages } });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// DELETE /api/ai/agent/conversations/:id
// Delete a conversation
// ═══════════════════════════════════════════════════════════════════════════════
export const deleteConversation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await AiConversation.findOneAndDelete({
      _id:       req.params.id,
      companyId: req.user!.companyId,
      userId:    req.user!.userId,
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/ai/agent/tools
// Returns the list of available agent tools (names + descriptions only, no internals)
// ═══════════════════════════════════════════════════════════════════════════════
export const getTools = async (_req: AuthRequest, res: Response): Promise<void> => {
  const tools = TOOLS.map(t => ({ name: t.name, description: t.description }));
  res.json({ success: true, tools });
};
