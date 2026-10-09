import { randomUUID } from 'node:crypto';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { AgentDispatchClient, AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import User from '../models/User';
import Company from '../models/Company';
import AiConversation from '../models/AiConversation';
import { runAgentTurn, AIProviderUnavailableError } from '../ai/agentRuntime';
import type { ToolContext } from '../ai/tools';
import { reserveAiRequest } from '../utils/planLimits';
import { recordUsage } from '../services/aiUsageTracker';
import { getEffectiveSubscription } from '../services/companySubscription';
import {
  CLOUDFLARE_AI_MODEL,
  GEMINI_MODEL,
  getConfiguredAgentAIProviders,
  OPENAI_MODEL,
  safeAIErrorLog,
} from '../services/geminiService';
import { TrackSource } from '@livekit/protocol';
import mongoose from 'mongoose';

const AGENT_NAME = 'tavro-voice';
const TOKEN_TTL_SECONDS = 5 * 60;
const VOICE_CREDENTIAL_TTL = '30m';
const VOICE_SESSION_ROLES = new Set(['owner', 'admin', 'manager', 'employee', 'guest']);
const LIVEKIT_ENV_KEYS = ['LIVEKIT_URL', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET'] as const;
const MAX_VOICE_PROMPT_LENGTH = 12_000;
const PENDING_ACTION_TTL_MS = 5 * 60_000;
const VOICE_CREDENTIAL_AUDIENCE = 'tavro-voice-agent';
const VOICE_CREDENTIAL_ISSUER = 'workgrind-backend';

interface VoiceCredential extends JwtPayload {
  sub: string;
  companyId: string;
  roomName: string;
  scope: 'tavro:voice:turn';
}

function voiceCredentialSecret(): string | undefined {
  const secret = process.env.TAVRO_VOICE_AGENT_SECRET?.trim();
  return secret && secret.length >= 32 ? secret : undefined;
}

function validLiveKitUrl(value: string | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    const secure = url.protocol === 'wss:';
    const localDevelopment = process.env.NODE_ENV !== 'production' && url.protocol === 'ws:';
    return (secure || localDevelopment) && !url.username && !url.password && !url.search && !url.hash;
  } catch {
    return false;
  }
}

function getMissingVoiceConfiguration(): string[] {
  const missing: string[] = LIVEKIT_ENV_KEYS.filter((key) => !process.env[key]?.trim());
  if (!validLiveKitUrl(process.env.LIVEKIT_URL?.trim()) && !missing.includes('LIVEKIT_URL')) {
    missing.push('LIVEKIT_URL');
  }
  if (!voiceCredentialSecret()) missing.push('TAVRO_VOICE_AGENT_SECRET (minimum 32 characters)');
  if (getConfiguredAgentAIProviders().length === 0) {
    missing.push('a configured Tavro AI provider (GEMINI_API_KEY, OPENAI_API_KEY, or Cloudflare AI credentials)');
  }
  return missing;
}

function liveKitApiHost(): string {
  const url = new URL(process.env.LIVEKIT_URL!.trim());
  url.protocol = url.protocol === 'wss:' ? 'https:' : 'http:';
  url.pathname = '/';
  url.search = '';
  url.hash = '';
  return url.origin;
}

function resolveCredential(req: AuthRequest): VoiceCredential | null {
  const secret = voiceCredentialSecret();
  const authorization = req.get('authorization');
  if (!secret || !authorization?.startsWith('Bearer ')) return null;

  try {
    const decoded = jwt.verify(authorization.slice(7), secret, {
      algorithms: ['HS256'],
      audience: VOICE_CREDENTIAL_AUDIENCE,
      issuer: VOICE_CREDENTIAL_ISSUER,
    });
    if (
      typeof decoded === 'string' ||
      typeof decoded.sub !== 'string' ||
      typeof decoded.companyId !== 'string' ||
      typeof decoded.roomName !== 'string' ||
      decoded.scope !== 'tavro:voice:turn'
    ) return null;
    return decoded as VoiceCredential;
  } catch {
    return null;
  }
}

function explicitVoiceConfirmation(message: string): 'approve' | 'reject' | null {
  const normalized = message
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s']/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const rejectionPhrases = new Set([
    'no', 'nope', 'cancel', 'cancel it', 'stop', 'do not', "don't", 'nahi', 'nahin',
    'nahi karna', 'mat karo', 'نہیں', 'نہ کریں', 'منسوخ کریں',
  ]);
  const approvalPhrases = new Set([
    'yes', 'yeah', 'yep', 'confirm', 'confirmed', 'go ahead', 'proceed', 'do it',
    'please do', 'yes confirm', 'that is correct', "that's correct", 'haan', 'han',
    'jee haan', 'ji haan', 'haan kar do', 'haan kar dein', 'kar do', 'kar dein',
    'theek hai kar do', 'theek hai kar dein', 'ہاں', 'جی ہاں', 'ہاں کر دیں',
    'جی ہاں کر دیں', 'کر دیں', 'کر دو',
  ]);
  if (rejectionPhrases.has(normalized)) return 'reject';
  if (approvalPhrases.has(normalized)) return 'approve';
  return null;
}

export const createVoiceSession = async (req: AuthRequest, res: Response): Promise<void> => {
  const missingConfiguration = getMissingVoiceConfiguration();
  if (missingConfiguration.length > 0) {
    console.warn('[Tavro Voice] Session request rejected: configuration is incomplete.', {
      missingConfiguration,
      httpStatus: 503,
    });
    res.status(503).json({
      success: false,
      code: 'VOICE_NOT_CONFIGURED',
      message: 'Tavro Voice is not configured on this server yet. Please try text chat or contact your administrator.',
    });
    return;
  }

  try {
    const user = await User.findById(req.user!.userId)
      .select('companyId role isActive isVerified isDeleted')
      .lean();
    const companyId = user?.companyId?.toString();
    const role = user?.role?.toLowerCase();

    if (
      !user ||
      !user.isActive ||
      !user.isVerified ||
      user.isDeleted ||
      !companyId ||
      companyId !== req.user!.companyId ||
      !role ||
      !VOICE_SESSION_ROLES.has(role)
    ) {
      res.status(403).json({
        success: false,
        code: 'WORKSPACE_MEMBERSHIP_REQUIRED',
        message: 'An active WorkGrind workspace membership is required to start a voice session.',
      });
      return;
    }

    const company = await Company.findById(companyId).select('isActive').lean();
    if (!company?.isActive) {
      res.status(403).json({
        success: false,
        code: 'WORKSPACE_UNAVAILABLE',
        message: 'Your WorkGrind workspace is unavailable. Please contact your administrator.',
      });
      return;
    }

    const roomName = `tavro-${randomUUID()}`;
    const accessToken = new AccessToken(
      process.env.LIVEKIT_API_KEY!.trim(),
      process.env.LIVEKIT_API_SECRET!.trim(),
      {
        identity: `member-${randomUUID()}`,
        name: 'WorkGrind Member',
        ttl: TOKEN_TTL_SECONDS,
      },
    );
    accessToken.addGrant({
      room: roomName,
      roomJoin: true,
      canPublishSources: [TrackSource.MICROPHONE],
      canSubscribe: true,
      canPublishData: false,
    });

    const voiceTurnToken = jwt.sign(
      {
        sub: req.user!.userId,
        companyId,
        roomName,
        scope: 'tavro:voice:turn',
      },
      voiceCredentialSecret()!,
      {
        algorithm: 'HS256',
        audience: VOICE_CREDENTIAL_AUDIENCE,
        issuer: VOICE_CREDENTIAL_ISSUER,
        expiresIn: VOICE_CREDENTIAL_TTL,
      },
    );
    const token = await accessToken.toJwt();
    const livekitHost = liveKitApiHost();
    const roomService = new RoomServiceClient(
      livekitHost,
      process.env.LIVEKIT_API_KEY!.trim(),
      process.env.LIVEKIT_API_SECRET!.trim(),
    );
    const dispatchService = new AgentDispatchClient(
      livekitHost,
      process.env.LIVEKIT_API_KEY!.trim(),
      process.env.LIVEKIT_API_SECRET!.trim(),
    );

    await roomService.createRoom({ name: roomName, emptyTimeout: 300, maxParticipants: 2 });
    try {
      await dispatchService.createDispatch(roomName, AGENT_NAME, {
        metadata: JSON.stringify({ voiceTurnToken }),
      });
    } catch (error) {
      try {
        await roomService.deleteRoom(roomName);
      } catch {
        console.warn('[Tavro Voice] Could not clean up an undispatched LiveKit room.', {
          roomId: roomName,
        });
      }
      throw error;
    }

    console.info('[Tavro Voice] Session token issued.', {
      requestId: req.get('x-request-id')?.replace(/[^\w.-]/g, '').slice(0, 128),
      roomId: roomName,
      role,
      httpStatus: 200,
    });
    res.status(200).json({
      success: true,
      serverUrl: process.env.LIVEKIT_URL!.trim(),
      token,
      roomName,
      expiresInSeconds: TOKEN_TTL_SECONDS,
    });
  } catch (error) {
    console.error('[Tavro Voice] Session dispatch failed.', {
      errorName: error instanceof Error ? error.name : 'UnknownError',
      httpStatus: 503,
    });
    res.status(503).json({
      success: false,
      code: 'VOICE_SESSION_UNAVAILABLE',
      message: 'Tavro Voice could not start a session right now. Please try again shortly.',
    });
  }
};

export const runVoiceTurn = async (req: AuthRequest, res: Response): Promise<void> => {
  const credential = resolveCredential(req);
  if (!credential || req.body?.roomName !== credential.roomName) {
    res.status(401).json({
      success: false,
      code: 'VOICE_CREDENTIAL_INVALID',
      message: 'This Tavro Voice session is invalid or expired. Start a new voice session.',
    });
    return;
  }

  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  if (!message || message.length > MAX_VOICE_PROMPT_LENGTH) {
    res.status(400).json({
      success: false,
      code: 'VOICE_MESSAGE_INVALID',
      message: 'A voice message is required and must be no longer than 12,000 characters.',
    });
    return;
  }

  const user = await User.findById(credential.sub)
    .select('companyId role isActive isVerified isDeleted')
    .lean();
  const role = user?.role?.toLowerCase();
  if (
    !user ||
    !user.isActive ||
    !user.isVerified ||
    user.isDeleted ||
    user.companyId?.toString() !== credential.companyId ||
    !role ||
    !VOICE_SESSION_ROLES.has(role)
  ) {
    res.status(403).json({
      success: false,
      code: 'VOICE_WORKSPACE_ACCESS_REVOKED',
      message: 'Your WorkGrind workspace access changed. Start a new voice session after restoring access.',
    });
    return;
  }

  const company = await Company.findById(credential.companyId).select('isActive').lean();
  if (!company?.isActive) {
    res.status(403).json({
      success: false,
      code: 'WORKSPACE_UNAVAILABLE',
      message: 'Your WorkGrind workspace is unavailable.',
    });
    return;
  }

  const conversationId = typeof req.body?.conversationId === 'string' ? req.body.conversationId : '';
  if (conversationId && !mongoose.isValidObjectId(conversationId)) {
    res.status(400).json({ success: false, code: 'VOICE_CONVERSATION_INVALID', message: 'The voice conversation is invalid.' });
    return;
  }

  let currentSubscription;
  try {
    currentSubscription = await getEffectiveSubscription(credential.sub);
  } catch (error) {
    console.error('[Tavro Voice] Subscription authorization failed.', {
      roomId: credential.roomName,
      errorName: error instanceof Error ? error.name : 'UnknownError',
      httpStatus: 503,
    });
    res.status(503).json({
      success: false,
      code: 'SUBSCRIPTION_CHECK_UNAVAILABLE',
      message: 'Tavro could not verify workspace access right now. Please try again shortly.',
    });
    return;
  }
  if (!currentSubscription.hasActiveAccess) {
    res.status(403).json({
      success: false,
      code: 'SUBSCRIPTION_REQUIRED',
      message: 'An active WorkGrind subscription is required to use Tavro AI.',
    });
    return;
  }
  if (!currentSubscription.planConfig.entitlements.aiAssistant) {
    res.status(403).json({
      success: false,
      code: 'PLAN_UPGRADE_REQUIRED',
      message: `${currentSubscription.planConfig.name} does not include Tavro AI.`,
      requiresUpgrade: true,
    });
    return;
  }

  let reservation;
  try {
    reservation = await reserveAiRequest(credential.sub);
  } catch (error) {
    console.error('[Tavro Voice] Usage authorization failed.', {
      roomId: credential.roomName,
      errorName: error instanceof Error ? error.name : 'UnknownError',
      httpStatus: 503,
    });
    res.status(503).json({
      success: false,
      code: 'AI_USAGE_CHECK_UNAVAILABLE',
      message: 'Tavro could not verify AI access right now. Please try again shortly.',
    });
    return;
  }
  if (!reservation.allowed || !reservation.subscription?.planConfig.entitlements.aiAssistant) {
    res.status(403).json({
      success: false,
      code: reservation.code ?? 'PLAN_UPGRADE_REQUIRED',
      message: reservation.reason ?? 'Your current plan does not include Tavro AI.',
      requiresUpgrade: reservation.upgrade ?? true,
    });
    return;
  }

  let conversation = conversationId
    ? await AiConversation.findOne({
        _id: conversationId,
        companyId: new mongoose.Types.ObjectId(credential.companyId),
        userId: new mongoose.Types.ObjectId(credential.sub),
      })
    : null;
  if (!conversation) {
    conversation = await AiConversation.create({
      companyId: new mongoose.Types.ObjectId(credential.companyId),
      userId: new mongoose.Types.ObjectId(credential.sub),
      title: message.slice(0, 80),
      messages: [],
    });
  }

  const now = Date.now();
  const pendingAction = conversation.pendingVoiceAction;
  const activePendingAction = pendingAction &&
    now - new Date(pendingAction.createdAt).getTime() <= PENDING_ACTION_TTL_MS
    ? pendingAction
    : undefined;
  if (!activePendingAction && pendingAction) conversation.pendingVoiceAction = undefined;
  const confirmation = activePendingAction ? explicitVoiceConfirmation(message) : null;
  const storedHistory = conversation.messages
    .filter((entry) => entry.role === 'user' || entry.role === 'assistant')
    .map((entry) => ({ role: entry.role as 'user' | 'assistant', content: entry.content }));
  const subscription = reservation.subscription;
  const ctx = {
    companyId: credential.companyId,
    userId: credential.sub,
    userRole: role,
    planName: subscription.planConfig.name,
    planId: subscription.plan,
    enabledFeatures: Object.entries(subscription.planConfig.entitlements)
      .filter(([, enabled]) => enabled)
      .map(([feature]) => feature),
    aiRequestsLimit: reservation.limit,
    aiRequestsUsed: reservation.current,
  };
  const validateVoiceAction = async (): Promise<ToolContext | null> => {
    const currentUser = await User.findById(credential.sub)
      .select('companyId role isActive isVerified isDeleted')
      .lean();
    const currentRole = currentUser?.role?.toLowerCase();
    if (
      !currentUser ||
      !currentUser.isActive ||
      !currentUser.isVerified ||
      currentUser.isDeleted ||
      currentUser.companyId?.toString() !== credential.companyId ||
      !currentRole ||
      !VOICE_SESSION_ROLES.has(currentRole)
    ) return null;

    const [currentCompany, currentPlan] = await Promise.all([
      Company.findById(credential.companyId).select('isActive').lean(),
      getEffectiveSubscription(credential.sub),
    ]);
    if (
      !currentCompany?.isActive ||
      !currentPlan.hasActiveAccess ||
      !currentPlan.planConfig.entitlements.aiAssistant
    ) return null;

    return {
      ...ctx,
      userRole: currentRole,
      planName: currentPlan.planConfig.name,
      planId: currentPlan.plan,
      enabledFeatures: Object.entries(currentPlan.planConfig.entitlements)
        .filter(([, enabled]) => enabled)
        .map(([feature]) => feature),
    };
  };

  const requestController = new AbortController();
  const requestTimeout = setTimeout(() => requestController.abort(), 50_000);
  const abortIfDisconnected = () => {
    if (!res.writableEnded) requestController.abort();
  };
  req.once('aborted', abortIfDisconnected);
  res.once('close', abortIfDisconnected);
  const startedAt = Date.now();

  try {
    const result = await runAgentTurn(message, storedHistory, ctx, {
      signal: requestController.signal,
      voiceMode: true,
      validateVoiceAction,
      ...(activePendingAction ? {
        voiceConfirmation: {
          approved: confirmation === 'approve',
          toolName: activePendingAction.toolName,
          args: activePendingAction.toolArgs,
        },
      } : {}),
    });
    const actionAwaitingConfirmation = result.toolSteps.find((step) => step.toolResult.requiresConfirmation);

    conversation.messages.push({ role: 'user', content: message, createdAt: new Date() });
    for (const step of result.toolSteps) {
      conversation.messages.push({
        role: 'tool',
        content: `Tool: ${step.toolName}`,
        toolName: step.toolName,
        toolResult: JSON.stringify(step.toolResult),
        createdAt: new Date(),
      });
    }
    conversation.messages.push({ role: 'assistant', content: result.reply, createdAt: new Date() });
    if (conversation.messages.length > 100) conversation.messages = conversation.messages.slice(-100);

    if (actionAwaitingConfirmation) {
      conversation.pendingVoiceAction = {
        toolName: actionAwaitingConfirmation.toolName,
        toolArgs: actionAwaitingConfirmation.toolArgs,
        createdAt: new Date(),
      };
    } else if (confirmation === 'approve' || confirmation === 'reject') {
      conversation.pendingVoiceAction = undefined;
    }
    await conversation.save();

    const durationMs = Date.now() - startedAt;
    const provider = result.provider === 'fallback' ? 'fallback' : result.provider;
    const modelName = provider === 'gemini'
      ? GEMINI_MODEL
      : provider === 'openai'
        ? OPENAI_MODEL
        : provider === 'cloudflare'
          ? CLOUDFLARE_AI_MODEL
          : 'identity_response';
    await recordUsage({
      companyId: credential.companyId,
      userId: credential.sub,
      feature: 'ai_voice_turn',
      provider,
      modelName,
      success: Boolean(result.reply),
      durationMs,
    });

    if (res.destroyed || res.writableEnded) return;
    res.status(200).json({
      success: true,
      reply: result.reply,
      conversationId: conversation._id.toString(),
    });
  } catch (error) {
    const providerFailure = error instanceof AIProviderUnavailableError;
    const safeError = safeAIErrorLog(error);
    console.error('[Tavro Voice] Turn failed.', {
      roomId: credential.roomName,
      provider: providerFailure ? error.provider ?? 'none' : undefined,
      model: providerFailure ? error.model ?? 'none' : undefined,
      status: providerFailure ? error.statusCode : safeError.status ?? 500,
      errorCategory: providerFailure ? error.category : safeError.category,
      fallbackAttempted: providerFailure ? error.fallbackAttempted : undefined,
      fallbackResult: providerFailure ? error.fallbackResult : undefined,
    });
    await recordUsage({
      companyId: credential.companyId,
      userId: credential.sub,
      feature: 'ai_voice_turn',
      provider: 'fallback',
      modelName: 'provider_error',
      success: false,
      errorMessage: providerFailure ? `Provider failure: ${error.category}` : safeError.message,
      durationMs: Date.now() - startedAt,
    });
    if (res.destroyed || res.writableEnded) return;
    res.status(providerFailure ? 503 : 500).json({
      success: false,
      code: providerFailure ? error.code : 'VOICE_TURN_FAILED',
      message: providerFailure
        ? 'Tavro AI is temporarily unavailable. Please try speaking again.'
        : 'Tavro could not complete that turn. Please try again.',
    });
  } finally {
    clearTimeout(requestTimeout);
    req.off('aborted', abortIfDisconnected);
    res.off('close', abortIfDisconnected);
  }
};
