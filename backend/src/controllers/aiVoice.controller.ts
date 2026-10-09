import { randomUUID } from 'crypto';
import { RoomAgentDispatch, RoomConfiguration, TrackSource } from '@livekit/protocol';
import { AccessToken } from 'livekit-server-sdk';
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import User from '../models/User';
import Company from '../models/Company';
import { reserveAiRequest } from '../utils/planLimits';
import { recordUsage } from '../services/aiUsageTracker';
import { GEMINI_MODEL, isGeminiConfigured } from '../services/geminiService';

const AGENT_NAME = 'tavro-voice';
const TOKEN_TTL_SECONDS = 5 * 60;
const VOICE_SESSION_ROLES = new Set(['owner', 'admin', 'manager', 'employee', 'guest']);
const LIVEKIT_ENV_KEYS = ['LIVEKIT_URL', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET'] as const;

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
  const missing = LIVEKIT_ENV_KEYS.filter((key) => !process.env[key]?.trim());
  if (!validLiveKitUrl(process.env.LIVEKIT_URL?.trim())) {
    if (!missing.includes('LIVEKIT_URL')) missing.push('LIVEKIT_URL');
  }
  if (!isGeminiConfigured()) missing.push('GEMINI_API_KEY');
  return missing;
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

    const reservation = await reserveAiRequest(req.user!.userId);
    if (!reservation.allowed) {
      res.status(403).json({
        success: false,
        code: reservation.code ?? 'AI_LIMIT_EXCEEDED',
        message: reservation.reason ?? 'Your WorkGrind AI usage limit has been reached.',
        requiresUpgrade: reservation.upgrade ?? false,
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
    accessToken.roomConfig = new RoomConfiguration({
      agents: [new RoomAgentDispatch({ agentName: AGENT_NAME })],
    });

    const token = await accessToken.toJwt();
    await recordUsage({
      companyId,
      userId: req.user!.userId,
      feature: 'ai_voice_session',
      provider: 'gemini',
      modelName: GEMINI_MODEL,
      success: true,
    });

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
    console.error('[Tavro Voice] Session token generation failed.', {
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
