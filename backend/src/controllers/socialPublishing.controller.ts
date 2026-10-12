import mongoose from 'mongoose';
import { Response } from 'express';
import AuditLog from '../models/AuditLog';
import Integration from '../models/Integration';
import SocialPost from '../models/SocialPost';
import { AuthRequest } from '../middleware/auth';
import { roleMatches } from '../config/organization';
import { runAgentTurn } from '../ai/agentRuntime';
import { reserveAiRequest } from '../utils/planLimits';
import { recordUsage } from '../services/aiUsageTracker';
import {
  CLOUDFLARE_AI_MODEL,
  GEMINI_MODEL,
  OPENAI_MODEL,
  safeAIErrorLog,
} from '../services/geminiService';
import { decryptProviderToken } from '../utils/providerTokenEncryption';
import {
  LINKEDIN_PUBLISHING_SCOPE,
  LINKEDIN_TEXT_POST_MAX_LENGTH,
  LinkedInApiError,
  getLinkedInApiVersion,
  publishLinkedInTextPost,
} from '../services/linkedinPublishing';

function companyIdOf(req: AuthRequest): mongoose.Types.ObjectId {
  return new mongoose.Types.ObjectId(req.user!.companyId);
}

function canReview(req: AuthRequest): boolean {
  return roleMatches(req.user!.role, ['owner', 'admin'], 'business');
}

function canManagePublishing(req: AuthRequest): boolean {
  return roleMatches(req.user!.role, ['owner', 'admin', 'manager'], 'business');
}

function validateText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text.length > 0 && text.length <= LINKEDIN_TEXT_POST_MAX_LENGTH ? text : null;
}

async function audit(
  req: AuthRequest,
  action: string,
  resourceId?: string,
  details?: Record<string, unknown>,
) {
  await AuditLog.create({
    companyId: companyIdOf(req),
    userId: new mongoose.Types.ObjectId(req.user!.userId),
    action,
    resource: 'SocialPost',
    ...(resourceId ? { resourceId } : {}),
    ...(details ? { details } : {}),
    ipAddress: req.ip,
  });
}

export const getLinkedInConnection = async (req: AuthRequest, res: Response): Promise<void> => {
  const connection = await Integration.findOne({
    companyId: companyIdOf(req),
    provider: 'linkedin',
  }).lean();
  const scopes = Array.isArray(connection?.config?.grantedScopes)
    ? connection.config.grantedScopes.filter((scope: unknown): scope is string => typeof scope === 'string')
    : [];
  const expiresAt = connection?.tokenExpiresAt ?? null;
  const tokenValid = Boolean(expiresAt && expiresAt.getTime() > Date.now());
  res.json({
    success: true,
    connection: {
      connected: connection?.status === 'connected' && tokenValid,
      status: connection?.status ?? 'disconnected',
      identityName: connection?.config?.identityName ?? null,
      identityEmail: connection?.config?.identityEmail ?? null,
      scopes,
      canPublishMemberPosts: scopes.includes(LINKEDIN_PUBLISHING_SCOPE) && tokenValid,
      expiresAt,
      errorCode: connection?.errorMessage ?? null,
    },
  });
};

export const disconnectLinkedIn = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!canReview(req)) {
    res.status(403).json({ success: false, message: 'Only a workspace owner or admin can disconnect LinkedIn.' });
    return;
  }
  const connection = await Integration.findOneAndUpdate(
    { companyId: companyIdOf(req), provider: 'linkedin' },
    {
      $set: { status: 'disconnected', errorMessage: null },
      $unset: { accessToken: 1, refreshToken: 1, tokenExpiresAt: 1 },
    },
    { new: true },
  );
  if (!connection) {
    res.status(404).json({ success: false, message: 'No LinkedIn publishing connection was found.' });
    return;
  }
  await audit(req, 'LINKEDIN_PUBLISHING_DISCONNECTED', connection._id.toString());
  res.json({ success: true });
};

export const listSocialPosts = async (req: AuthRequest, res: Response): Promise<void> => {
  const posts = await SocialPost.find({ companyId: companyIdOf(req) })
    .sort({ updatedAt: -1 })
    .limit(100)
    .populate('authorId', 'fullName avatar')
    .populate('reviewerId', 'fullName avatar')
    .lean();
  res.json({ success: true, posts });
};

export const createSocialDraft = async (req: AuthRequest, res: Response): Promise<void> => {
  const text = validateText(req.body?.text);
  if (!text) {
    res.status(400).json({
      success: false,
      message: `Post text must contain 1–${LINKEDIN_TEXT_POST_MAX_LENGTH} characters.`,
    });
    return;
  }
  const post = await SocialPost.create({
    companyId: companyIdOf(req),
    authorId: new mongoose.Types.ObjectId(req.user!.userId),
    text,
    status: 'draft',
  });
  await audit(req, 'LINKEDIN_POST_DRAFT_CREATED', post._id.toString());
  res.status(201).json({ success: true, post });
};

export const updateSocialDraft = async (req: AuthRequest, res: Response): Promise<void> => {
  const text = validateText(req.body?.text);
  if (!text) {
    res.status(400).json({
      success: false,
      message: `Post text must contain 1–${LINKEDIN_TEXT_POST_MAX_LENGTH} characters.`,
    });
    return;
  }
  const post = await SocialPost.findOne({
    _id: req.params.id,
    companyId: companyIdOf(req),
    $or: [
      { status: { $in: ['draft', 'rejected'] } },
      { status: 'failed', failureCode: { $in: ['rate_limited', 'post_rejected'] } },
    ],
    ...(canReview(req) ? {} : { authorId: new mongoose.Types.ObjectId(req.user!.userId) }),
  });
  if (!post) {
    res.status(404).json({ success: false, message: 'Editable draft not found.' });
    return;
  }
  post.text = text;
  post.status = 'draft';
  post.reviewerId = undefined;
  post.rejectionReason = undefined;
  post.failureCode = undefined;
  await post.save();
  await audit(req, 'LINKEDIN_POST_DRAFT_UPDATED', post._id.toString());
  res.json({ success: true, post });
};

export const requestSocialPostApproval = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!roleMatches(req.user!.role, ['manager'], 'business')) {
    res.status(403).json({ success: false, message: 'Only a workspace manager can submit a post for approval.' });
    return;
  }
  const post = await SocialPost.findOneAndUpdate(
    {
      _id: req.params.id,
      companyId: companyIdOf(req),
      authorId: new mongoose.Types.ObjectId(req.user!.userId),
      status: { $in: ['draft', 'rejected'] },
    },
    { $set: { status: 'pending_approval' }, $unset: { reviewerId: 1, rejectionReason: 1 } },
    { new: true },
  );
  if (!post) {
    res.status(404).json({ success: false, message: 'Draft not found or it cannot be submitted for approval.' });
    return;
  }
  await audit(req, 'LINKEDIN_POST_SUBMITTED_FOR_APPROVAL', post._id.toString());
  res.json({ success: true, post });
};

export const reviewSocialPost = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!canReview(req)) {
    res.status(403).json({ success: false, message: 'Only a workspace owner or admin can review posts.' });
    return;
  }
  const decision = req.params.decision;
  if (decision !== 'approve' && decision !== 'reject') {
    res.status(404).json({ success: false, message: 'Review action not found.' });
    return;
  }
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 500) : '';
  const post = await SocialPost.findOneAndUpdate(
    {
      _id: req.params.id,
      companyId: companyIdOf(req),
      status: 'pending_approval',
      authorId: { $ne: new mongoose.Types.ObjectId(req.user!.userId) },
    },
    {
      $set: {
        status: decision === 'approve' ? 'approved' : 'rejected',
        reviewerId: new mongoose.Types.ObjectId(req.user!.userId),
        ...(decision === 'reject' && reason ? { rejectionReason: reason } : {}),
      },
    },
    { new: true },
  );
  if (!post) {
    res.status(404).json({ success: false, message: 'Post awaiting review was not found.' });
    return;
  }
  await audit(req, decision === 'approve' ? 'LINKEDIN_POST_APPROVED' : 'LINKEDIN_POST_REJECTED', post._id.toString());
  res.json({ success: true, post });
};

export const publishSocialPost = async (req: AuthRequest, res: Response): Promise<void> => {
  const role = req.user!.role;
  if (!canManagePublishing(req)) {
    res.status(403).json({ success: false, message: 'Your workspace role cannot publish LinkedIn posts.' });
    return;
  }
  getLinkedInApiVersion();
  const connection = await Integration.findOne({
    companyId: companyIdOf(req),
    provider: 'linkedin',
    status: 'connected',
  }).select('+accessToken');
  if (!connection?.accessToken ||
      !Array.isArray(connection.config?.grantedScopes) ||
      !connection.config.grantedScopes.includes(LINKEDIN_PUBLISHING_SCOPE) ||
      typeof connection.config.linkedinSubject !== 'string' ||
      !connection.config.linkedinSubject ||
      !connection.tokenExpiresAt ||
      connection.tokenExpiresAt.getTime() <= Date.now()) {
    res.status(409).json({
      success: false,
      code: 'LINKEDIN_RECONNECT_REQUIRED',
      message: 'Reconnect LinkedIn and grant member-posting permission before publishing.',
    });
    return;
  }
  const allowedStatuses = canReview(req) ? ['draft', 'approved'] : ['approved'];
  const post = await SocialPost.findOneAndUpdate(
    {
      _id: req.params.id,
      companyId: companyIdOf(req),
      status: { $in: allowedStatuses },
    },
    { $set: { status: 'publishing' }, $unset: { failureCode: 1 } },
    { new: true },
  );
  if (!post) {
    res.status(409).json({
      success: false,
      message: roleMatches(role, ['manager'], 'business')
        ? 'A workspace owner or admin must approve this draft before publication.'
        : 'This post is not available to publish or is already being processed.',
    });
    return;
  }

  let linkedinConfirmed = false;
  try {
    const accessToken = decryptProviderToken(connection.accessToken);
    const result = await publishLinkedInTextPost(
      accessToken,
      String(connection.config.linkedinSubject),
      post.text,
    );
    linkedinConfirmed = true;
    await SocialPost.updateOne(
      { _id: post._id, companyId: post.companyId, status: 'publishing' },
      {
        $set: {
          status: 'published',
          publishedAt: new Date(),
          ...(result.postUrn ? { linkedinPostUrn: result.postUrn } : {}),
          ...(result.postUrl ? { linkedinPostUrl: result.postUrl } : {}),
        },
        $unset: { failureCode: 1 },
      },
    );
    try {
      await audit(req, 'LINKEDIN_POST_PUBLISHED', post._id.toString());
    } catch (auditError) {
      console.error('[SocialPublishing] Published post audit write failed.', {
        errorName: auditError instanceof Error ? auditError.name : 'UnknownError',
      });
      res.status(503).json({
        success: false,
        code: 'PUBLISHED_AUDIT_PENDING',
        message: 'LinkedIn confirmed the post, but WorkGrind could not record its audit log. Do not publish it again.',
      });
      return;
    }
    res.json({ success: true, post: { ...post.toObject(), status: 'published', ...result, publishedAt: new Date() } });
  } catch (error) {
    if (linkedinConfirmed) {
      console.error('[SocialPublishing] LinkedIn confirmed publication but WorkGrind could not persist the result.', {
        errorName: error instanceof Error ? error.name : 'UnknownError',
      });
      res.status(503).json({
        success: false,
        code: 'PUBLISH_RESULT_NOT_RECORDED',
        message: 'LinkedIn confirmed publication, but WorkGrind could not save the result. Do not publish it again.',
      });
      return;
    }
    const status = error instanceof LinkedInApiError ? error.status : undefined;
    const failureCode = status === 401
      ? 'authorization_revoked'
      : status === 403
        ? 'permission_or_member_access_denied'
        : status === 429
          ? 'rate_limited'
          : error instanceof Error && error.name === 'TimeoutError'
            ? 'provider_timeout'
            : status && status >= 400 && status < 500
              ? 'post_rejected'
              : 'provider_unavailable';
    await SocialPost.updateOne(
      { _id: post._id, companyId: post.companyId, status: 'publishing' },
      { $set: { status: 'failed', failureCode } },
    );
    if (status === 401 || status === 403) {
      connection.status = 'error';
      connection.errorMessage = failureCode;
      await connection.save();
    }
    await audit(req, 'LINKEDIN_POST_PUBLISH_FAILED', post._id.toString(), { failureCode });
    res.status(status === 429 ? 429 : status === 401 || status === 403 ? 409 : 502).json({
      success: false,
      code: failureCode,
      message: failureCode === 'rate_limited'
        ? 'LinkedIn is rate limiting publish requests. Wait before trying again.'
        : failureCode === 'authorization_revoked' || failureCode === 'permission_or_member_access_denied'
          ? 'LinkedIn authorization or member posting permission is unavailable. Reconnect LinkedIn and verify access.'
          : failureCode === 'post_rejected'
            ? 'LinkedIn rejected this post. Review its text and try saving an updated draft.'
            : 'LinkedIn could not confirm publication. Check the post status before taking further action.',
    });
  }
};

export const generateSocialDraft = async (req: AuthRequest, res: Response): Promise<void> => {
  const topic = typeof req.body?.topic === 'string' ? req.body.topic.trim() : '';
  const details = typeof req.body?.details === 'string' ? req.body.details.trim() : '';
  const style = typeof req.body?.style === 'string' ? req.body.style : 'professional update';
  if (!topic || topic.length > 500 || details.length > 1500 ||
      !['professional update', 'product announcement', 'marketing post'].includes(style)) {
    res.status(400).json({ success: false, message: 'Provide a topic, supported writing style, and optional details within the length limits.' });
    return;
  }

  const limit = await reserveAiRequest(req.user!.userId);
  if (!limit.allowed) {
    res.status(403).json({
      success: false,
      code: limit.code,
      message: limit.reason,
      requiresUpgrade: limit.upgrade ?? false,
    });
    return;
  }
  if (!limit.subscription) throw new Error('Subscription data was not available after the AI limit check.');

  const startedAt = Date.now();
  try {
    const result = await runAgentTurn(
      `Write a LinkedIn ${style} draft about this topic: ${topic}${details ? `\n\nUser-provided facts and context (do not add unsupported claims):\n${details}` : ''}\n\nReturn only the proposed post text, under 3000 characters. Do not publish, schedule, or claim any action was taken.`,
      [],
      {
        companyId: '',
        userId: req.user!.userId,
        userRole: req.user!.role,
        accountType: req.user!.accountType,
        organizationType: req.user!.organizationType,
        planName: limit.subscription.planConfig.name,
        planId: limit.subscription.plan,
      },
    );
    const text = result.reply.trim().slice(0, LINKEDIN_TEXT_POST_MAX_LENGTH);
    if (!text) throw new Error('Tavro returned an empty post draft.');
    await recordUsage({
      companyId: req.user!.companyId,
      userId: req.user!.userId,
      feature: 'linkedin_post_draft',
      provider: result.provider,
      modelName: result.provider === 'gemini'
        ? GEMINI_MODEL
        : result.provider === 'openai'
          ? OPENAI_MODEL
          : result.provider === 'cloudflare'
            ? CLOUDFLARE_AI_MODEL
            : 'fallback',
      success: true,
      durationMs: Date.now() - startedAt,
    });
    res.json({ success: true, draft: text });
  } catch (error) {
    const safeError = safeAIErrorLog(error);
    await recordUsage({
      companyId: req.user!.companyId,
      userId: req.user!.userId,
      feature: 'linkedin_post_draft',
      provider: 'fallback',
      modelName: 'provider_unavailable',
      success: false,
      errorMessage: safeError.category,
      durationMs: Date.now() - startedAt,
    });
    console.error('[Tavro AI] LinkedIn draft generation failed.', { category: safeError.category });
    res.status(503).json({
      success: false,
      message: 'Tavro could not generate a draft right now. Your text remains unchanged; try again shortly.',
    });
  }
};
