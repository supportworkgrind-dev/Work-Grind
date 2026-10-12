import mongoose from 'mongoose';
import { timingSafeEqual } from 'crypto';
import { Response } from 'express';
import AuditLog from '../models/AuditLog';
import Company from '../models/Company';
import Integration from '../models/Integration';
import SocialPost from '../models/SocialPost';
import User from '../models/User';
import { AuthRequest } from '../middleware/auth';
import { roleMatches } from '../config/organization';
import { getCompanySubscription } from '../services/companySubscription';
import { createNotification } from './channel.controller';
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
  getSocialProviderAdapter,
  getSocialProviderCatalog,
  LinkedInApiError,
} from '../services/socialProviders';
import {
  LINKEDIN_PUBLISHING_SCOPE,
  LINKEDIN_TEXT_POST_MAX_LENGTH,
  getLinkedInApiVersion,
} from '../services/linkedinPublishing';

function companyIdOf(req: AuthRequest): mongoose.Types.ObjectId {
  return new mongoose.Types.ObjectId(req.user!.companyId);
}

function canReview(req: AuthRequest): boolean {
  return roleMatches(req.user!.role, ['owner', 'admin'], req.user!.organizationType);
}

function canManagePublishing(req: AuthRequest): boolean {
  return roleMatches(req.user!.role, ['owner', 'admin', 'manager'], req.user!.organizationType);
}

function canRequestApproval(req: AuthRequest): boolean {
  return roleMatches(
    req.user!.role,
    ['manager', 'employee', 'teacher', 'faculty'],
    req.user!.organizationType,
  );
}

function getProviderId(value: unknown): string {
  return typeof value === 'string' ? value : 'linkedin';
}

function validateProviderText(providerId: string, value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const adapter = getSocialProviderAdapter(providerId);
  if (!adapter) return 'This provider is not configured for publishing.';
  return adapter.validateText(value);
}

function validTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 100) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

function hasExplicitDateZone(value: string): boolean {
  return /(?:Z|[+-]\d{2}:\d{2})$/i.test(value);
}

function isCronAuthorized(req: AuthRequest): boolean {
  const secret = process.env.CRON_SECRET;
  const header = req.get('authorization') ?? '';
  const supplied = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!secret || !supplied) return false;
  const expectedBytes = Buffer.from(secret);
  const suppliedBytes = Buffer.from(supplied);
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
}

async function markPostFailed(post: {
  _id: mongoose.Types.ObjectId;
  companyId: mongoose.Types.ObjectId;
  authorId: mongoose.Types.ObjectId;
}, failureCode: string): Promise<void> {
  await SocialPost.updateOne(
    { _id: post._id, companyId: post.companyId, status: 'publishing' },
    {
      $set: {
        status: 'failed',
        failureCode,
        'destinations.$[destination].status': 'failed',
        'destinations.$[destination].errorCode': failureCode,
      },
    },
    { arrayFilters: [{ 'destination.provider': 'linkedin', 'destination.status': 'publishing' }] },
  );
  try {
    await createNotification({
      companyId: post.companyId.toString(),
      userId: post.authorId.toString(),
      type: 'system',
      title: 'Social post needs attention',
      body: `LinkedIn could not confirm publication (${failureCode.replaceAll('_', ' ')}). Review the post before retrying.`,
      actionUrl: '/social-publishing',
      metadata: { postId: post._id.toString(), failureCode },
    });
  } catch (notificationError) {
    console.error('[SocialPublishing] Failure notification could not be created.', {
      errorName: notificationError instanceof Error ? notificationError.name : 'UnknownError',
    });
  }
}

async function notifyPublishingUser(data: Parameters<typeof createNotification>[0]): Promise<void> {
  try {
    await createNotification(data);
  } catch (error) {
    console.error('[SocialPublishing] Notification could not be created.', {
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
  }
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
      canPublishMemberPosts: connection?.status === 'connected' &&
        scopes.includes(LINKEDIN_PUBLISHING_SCOPE) && tokenValid,
      expiresAt,
      errorCode: connection?.errorMessage ?? null,
    },
  });
};

export const getSocialProviders = async (_req: AuthRequest, res: Response): Promise<void> => {
  res.json({ success: true, providers: getSocialProviderCatalog() });
};

export const getSocialAccounts = async (req: AuthRequest, res: Response): Promise<void> => {
  const integrations = await Integration.find({
    companyId: companyIdOf(req),
    provider: { $in: ['linkedin', 'instagram', 'facebook', 'youtube'] },
  }).select('provider status config tokenExpiresAt errorMessage').lean();
  const now = Date.now();
  const accounts = integrations.map((integration) => {
    const adapter = getSocialProviderAdapter(integration.provider);
    const scopes = Array.isArray(integration.config?.grantedScopes)
      ? integration.config.grantedScopes.filter((scope: unknown): scope is string => typeof scope === 'string')
      : [];
    const tokenValid = Boolean(integration.tokenExpiresAt && integration.tokenExpiresAt.getTime() > now);
    return {
      id: integration._id.toString(),
      provider: integration.provider,
      status: integration.status,
      displayName: integration.config?.identityName ?? null,
      displayEmail: integration.config?.identityEmail ?? null,
      expiresAt: integration.tokenExpiresAt ?? null,
      scopes,
      canPublish: integration.status === 'connected' && tokenValid &&
        Boolean(adapter?.capabilities.publishText) &&
        (integration.provider !== 'linkedin' || scopes.includes(LINKEDIN_PUBLISHING_SCOPE)),
    };
  });
  res.json({ success: true, accounts });
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
  const platform = getProviderId(req.body?.platform);
  const adapter = getSocialProviderAdapter(platform);
  if (!adapter) {
    res.status(422).json({ success: false, code: 'PROVIDER_UNAVAILABLE', message: 'This social provider is not configured for publishing.' });
    return;
  }
  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  const validationError = adapter.validateText(text);
  if (validationError) {
    res.status(400).json({
      success: false,
      message: validationError,
    });
    return;
  }
  let integrationId: mongoose.Types.ObjectId | undefined;
  if (req.body?.integrationId !== undefined) {
    if (!mongoose.isValidObjectId(req.body.integrationId)) {
      res.status(400).json({ success: false, message: 'Select a valid connected social account.' });
      return;
    }
    const integration = await Integration.findOne({
      _id: req.body.integrationId,
      companyId: companyIdOf(req),
      provider: platform,
      status: 'connected',
    }).select('_id');
    if (!integration) {
      res.status(404).json({ success: false, message: 'The selected social account is not connected to this workspace.' });
      return;
    }
    integrationId = integration._id;
  }
  const post = await SocialPost.create({
    companyId: companyIdOf(req),
    authorId: new mongoose.Types.ObjectId(req.user!.userId),
    text,
    platform,
    ...(integrationId ? { integrationId } : {}),
    status: 'draft',
  });
  await audit(req, 'SOCIAL_POST_DRAFT_CREATED', post._id.toString(), { platform });
  res.status(201).json({ success: true, post });
};

export const updateSocialDraft = async (req: AuthRequest, res: Response): Promise<void> => {
  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  const postQuery = {
    _id: req.params.id,
    companyId: companyIdOf(req),
    $or: [
      { status: { $in: ['draft', 'rejected'] } },
      { status: 'failed', failureCode: { $in: ['rate_limited', 'post_rejected'] } },
    ],
    ...(canReview(req) ? {} : { authorId: new mongoose.Types.ObjectId(req.user!.userId) }),
  };
  const candidate = await SocialPost.findOne(postQuery).select('platform');
  if (!candidate) {
    res.status(404).json({ success: false, message: 'Editable draft not found.' });
    return;
  }
  const validationError = validateProviderText(candidate.platform, text);
  if (validationError) {
    res.status(400).json({
      success: false,
      message: validationError || 'Editable draft not found.',
    });
    return;
  }
  const post = await SocialPost.findOne(postQuery);
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
  await audit(req, 'SOCIAL_POST_DRAFT_UPDATED', post._id.toString(), { platform: post.platform });
  res.json({ success: true, post });
};

export const deleteSocialDraft = async (req: AuthRequest, res: Response): Promise<void> => {
  const post = await SocialPost.findOneAndDelete({
    _id: req.params.id,
    companyId: companyIdOf(req),
    status: { $in: ['draft', 'rejected', 'failed'] },
    ...(canReview(req) ? {} : { authorId: new mongoose.Types.ObjectId(req.user!.userId) }),
  });
  if (!post) {
    res.status(404).json({ success: false, message: 'Deletable draft not found.' });
    return;
  }
  await audit(req, 'SOCIAL_POST_DRAFT_DELETED', post._id.toString(), { platform: post.platform });
  res.json({ success: true });
};

export const requestSocialPostApproval = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!canRequestApproval(req)) {
    res.status(403).json({ success: false, message: 'Your workspace role cannot request publishing approval.' });
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
  await audit(req, 'SOCIAL_POST_SUBMITTED_FOR_APPROVAL', post._id.toString(), { platform: post.platform });
  const approvers = await User.find({
    companyId: post.companyId,
    isActive: true,
    isVerified: true,
    isDeleted: { $ne: true },
  }).select('_id role').lean();
  await Promise.all(approvers
    .filter((approver) => roleMatches(approver.role, ['owner', 'admin'], req.user!.organizationType))
    .map((approver) => notifyPublishingUser({
      companyId: post.companyId.toString(),
      userId: approver._id.toString(),
      type: 'system',
      title: 'Social post awaiting review',
      body: `${req.user!.role} submitted a ${post.platform} post for approval.`,
      actionUrl: '/social-publishing',
      metadata: { postId: post._id.toString() },
    })));
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
  await audit(req, decision === 'approve' ? 'SOCIAL_POST_APPROVED' : 'SOCIAL_POST_REJECTED', post._id.toString(), { platform: post.platform });
  await notifyPublishingUser({
    companyId: post.companyId.toString(),
    userId: post.authorId.toString(),
    type: 'system',
    title: decision === 'approve' ? 'Social post approved' : 'Social post needs changes',
    body: decision === 'approve' ? 'Your social post was approved for publishing.' : reason || 'Your social post was rejected for changes.',
    actionUrl: '/social-publishing',
    metadata: { postId: post._id.toString(), decision },
  });
  res.json({ success: true, post });
};

export const publishSocialPost = async (req: AuthRequest, res: Response): Promise<void> => {
  const role = req.user!.role;
  if (!canManagePublishing(req)) {
    res.status(403).json({ success: false, message: 'Your workspace role cannot publish social posts.' });
    return;
  }
  const adapter = getSocialProviderAdapter('linkedin');
  if (!adapter?.capabilities.publishText) {
    res.status(422).json({ success: false, code: 'PROVIDER_UNAVAILABLE', message: 'This provider cannot publish text posts.' });
    return;
  }
  getLinkedInApiVersion();
  const connection = await Integration.findOne({
    companyId: companyIdOf(req),
    provider: 'linkedin',
    status: 'connected',
    ...(req.body?.integrationId
      ? mongoose.isValidObjectId(req.body.integrationId) ? { _id: req.body.integrationId } : { _id: null }
      : {}),
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
      platform: adapter.id,
      ...(req.body?.integrationId ? { integrationId: req.body.integrationId } : {}),
      status: { $in: allowedStatuses },
    },
    {
      $set: {
        status: 'publishing',
        destinations: [{ provider: adapter.id, integrationId: connection._id, status: 'publishing' }],
      },
      $unset: { failureCode: 1 },
    },
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
    const result = await adapter.publishText(
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
          destinations: [{
            provider: adapter.id,
            integrationId: connection._id,
            status: 'published',
            ...(result.externalPostId ? { externalPostId: result.externalPostId } : {}),
            ...(result.externalPostUrl ? { externalPostUrl: result.externalPostUrl } : {}),
            publishedAt: new Date(),
          }],
          ...(result.externalPostId ? { linkedinPostUrn: result.externalPostId } : {}),
          ...(result.externalPostUrl ? { linkedinPostUrl: result.externalPostUrl } : {}),
        },
        $unset: { failureCode: 1 },
      },
    );
    try {
      await audit(req, 'SOCIAL_POST_PUBLISHED', post._id.toString(), { platform: adapter.id });
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
    await notifyPublishingUser({
        companyId: post.companyId.toString(),
        userId: post.authorId.toString(),
        type: 'system',
        title: 'Social post published',
        body: 'LinkedIn confirmed publication.',
        actionUrl: '/social-publishing',
        metadata: { postId: post._id.toString(), platform: adapter.id },
      });
    res.json({
      success: true,
      post: {
        ...post.toObject(),
        status: 'published',
        linkedinPostUrn: result.externalPostId,
        linkedinPostUrl: result.externalPostUrl,
        publishedAt: new Date(),
      },
    });
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
    await markPostFailed(post, failureCode);
    if (status === 401 || status === 403) {
      connection.status = 'error';
      connection.errorMessage = failureCode;
      await connection.save();
    }
    await audit(req, 'SOCIAL_POST_PUBLISH_FAILED', post._id.toString(), { platform: adapter.id, failureCode });
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

export const scheduleSocialPost = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!canManagePublishing(req)) {
    res.status(403).json({ success: false, message: 'Your workspace role cannot schedule social posts.' });
    return;
  }
  const scheduledAtValue = req.body?.scheduledAt;
  const timeZone = req.body?.timeZone;
  if (typeof scheduledAtValue !== 'string' || !hasExplicitDateZone(scheduledAtValue) || !validTimeZone(timeZone)) {
    res.status(400).json({ success: false, message: 'Provide a scheduled time with a timezone and a valid IANA time zone.' });
    return;
  }
  const scheduledAt = new Date(scheduledAtValue);
  const now = Date.now();
  if (!Number.isFinite(scheduledAt.getTime()) ||
      scheduledAt.getTime() < now + 5 * 60_000 ||
      scheduledAt.getTime() > now + 365 * 24 * 60 * 60_000) {
    res.status(400).json({ success: false, message: 'Choose a time at least 5 minutes and no more than one year in the future.' });
    return;
  }

  const allowedStatuses = canReview(req) ? ['draft', 'approved'] : ['approved'];
  const post = await SocialPost.findOne({
    _id: req.params.id,
    companyId: companyIdOf(req),
    platform: 'linkedin',
    status: { $in: allowedStatuses },
    ...(canReview(req) ? {} : { authorId: new mongoose.Types.ObjectId(req.user!.userId) }),
  });
  if (!post) {
    res.status(409).json({
      success: false,
      message: canReview(req)
        ? 'Only a draft or approved post can be scheduled.'
        : 'A workspace owner or admin must approve this post before it can be scheduled.',
    });
    return;
  }

  const connection = await Integration.findOne({
    companyId: companyIdOf(req),
    provider: 'linkedin',
    status: 'connected',
    ...(post.integrationId ? { _id: post.integrationId } : {}),
  }).select('config tokenExpiresAt');
  if (!connection ||
      !connection.config?.grantedScopes?.includes(LINKEDIN_PUBLISHING_SCOPE) ||
      !connection.tokenExpiresAt ||
      connection.tokenExpiresAt.getTime() <= scheduledAt.getTime()) {
    res.status(409).json({
      success: false,
      code: 'LINKEDIN_RECONNECT_REQUIRED',
      message: 'Connect LinkedIn with member-post permission and ensure authorization remains valid through the scheduled time.',
    });
    return;
  }

  const adapter = getSocialProviderAdapter(post.platform);
  const validationError = adapter?.validateText(post.text);
  if (!adapter?.capabilities.schedule || validationError) {
    res.status(422).json({
      success: false,
      code: 'SCHEDULE_UNAVAILABLE',
      message: validationError || 'This provider does not support scheduled publishing.',
    });
    return;
  }

  const originalStatus = post.status as 'draft' | 'approved';
  post.status = 'scheduled';
  post.scheduledAt = scheduledAt;
  post.scheduleTimeZone = timeZone;
  post.scheduledFromStatus = originalStatus;
  post.scheduledBy = new mongoose.Types.ObjectId(req.user!.userId);
  post.integrationId = connection._id;
  post.scheduleAttempts = 0;
  post.failureCode = undefined;
  await post.save();
  await audit(req, 'SOCIAL_POST_SCHEDULED', post._id.toString(), {
    platform: post.platform,
    scheduledAt: scheduledAt.toISOString(),
    timeZone,
  });
  res.json({ success: true, post });
};

export const cancelSocialPostSchedule = async (req: AuthRequest, res: Response): Promise<void> => {
  const post = await SocialPost.findOne({
    _id: req.params.id,
    companyId: companyIdOf(req),
    status: 'scheduled',
    ...(canReview(req) ? {} : { authorId: new mongoose.Types.ObjectId(req.user!.userId) }),
  });
  if (!post) {
    res.status(404).json({ success: false, message: 'Scheduled post not found or cannot be cancelled.' });
    return;
  }
  post.status = post.scheduledFromStatus ?? 'draft';
  post.scheduledAt = undefined;
  post.scheduleTimeZone = undefined;
  post.scheduledFromStatus = undefined;
  post.scheduledBy = undefined;
  post.scheduleAttempts = 0;
  await post.save();
  await audit(req, 'SOCIAL_POST_SCHEDULE_CANCELLED', post._id.toString(), { platform: post.platform });
  res.json({ success: true, post });
};

async function publishScheduledPost(postId: mongoose.Types.ObjectId): Promise<'published' | 'failed' | 'retrying' | 'skipped'> {
  const post = await SocialPost.findOneAndUpdate(
    { _id: postId, status: 'scheduled', scheduledAt: { $lte: new Date() } },
    {
      $set: {
        status: 'publishing',
        destinations: [{ provider: 'linkedin', status: 'publishing' }],
      },
    },
    { new: true },
  );
  if (!post) return 'skipped';

  const [company, publisher] = await Promise.all([
    Company.findOne({ _id: post.companyId, isActive: true }).select('organizationType accountType'),
    User.findOne({
      _id: post.scheduledBy ?? post.authorId,
      companyId: post.companyId,
      isActive: true,
      isVerified: true,
      isDeleted: { $ne: true },
    }).select('_id role'),
  ]);
  if (!company || !publisher ||
      !roleMatches(publisher.role, ['owner', 'admin', 'manager'], company.organizationType)) {
    await markPostFailed(post, 'workspace_or_publisher_unavailable');
    return 'failed';
  }

  let subscription;
  try {
    subscription = await getCompanySubscription(post.companyId.toString());
  } catch (error) {
    console.error('[SocialPublishing] Scheduled subscription check failed.', {
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
    await SocialPost.updateOne(
      { _id: post._id, status: 'publishing' },
      { $set: { status: 'scheduled', scheduledAt: new Date(Date.now() + 5 * 60_000) } },
    );
    return 'retrying';
  }
  if (!subscription.hasActiveAccess) {
    await markPostFailed(post, 'subscription_inactive');
    return 'failed';
  }

  const connection = await Integration.findOne({
    _id: post.integrationId,
    companyId: post.companyId,
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
    await markPostFailed(post, 'authorization_revoked');
    return 'failed';
  }

  const adapter = getSocialProviderAdapter(post.platform);
  if (!adapter?.capabilities.schedule || !adapter.capabilities.publishText) {
    await markPostFailed(post, 'provider_schedule_unavailable');
    return 'failed';
  }

  let providerConfirmed = false;
  try {
    const result = await adapter.publishText(
      decryptProviderToken(connection.accessToken),
      String(connection.config.linkedinSubject),
      post.text,
    );
    providerConfirmed = true;
    await SocialPost.updateOne(
      { _id: post._id, status: 'publishing' },
      {
        $set: {
          status: 'published',
          publishedAt: new Date(),
          destinations: [{
            provider: adapter.id,
            integrationId: connection._id,
            status: 'published',
            ...(result.externalPostId ? { externalPostId: result.externalPostId } : {}),
            ...(result.externalPostUrl ? { externalPostUrl: result.externalPostUrl } : {}),
            publishedAt: new Date(),
          }],
          ...(result.externalPostId ? { linkedinPostUrn: result.externalPostId } : {}),
          ...(result.externalPostUrl ? { linkedinPostUrl: result.externalPostUrl } : {}),
        },
        $unset: {
          scheduledAt: 1,
          scheduleTimeZone: 1,
          scheduledFromStatus: 1,
          scheduledBy: 1,
          failureCode: 1,
        },
      },
    );
    await AuditLog.create({
      companyId: post.companyId,
      userId: publisher._id,
      action: 'SOCIAL_POST_PUBLISHED',
      resource: 'SocialPost',
      resourceId: post._id.toString(),
      details: { platform: adapter.id, scheduled: true },
    });
    await notifyPublishingUser({
        companyId: post.companyId.toString(),
        userId: post.authorId.toString(),
        type: 'system',
        title: 'Scheduled social post published',
        body: 'LinkedIn confirmed publication.',
        actionUrl: '/social-publishing',
        metadata: { postId: post._id.toString(), platform: adapter.id },
      });
    return 'published';
  } catch (error) {
    if (providerConfirmed) {
      console.error('[SocialPublishing] LinkedIn confirmed scheduled publication but WorkGrind could not persist it.', {
        errorName: error instanceof Error ? error.name : 'UnknownError',
      });
      return 'failed';
    }
    const status = error instanceof LinkedInApiError ? error.status : undefined;
    if (status === 429 && post.scheduleAttempts < 2) {
      await SocialPost.updateOne(
        { _id: post._id, status: 'publishing' },
        {
          $set: {
            status: 'scheduled',
            scheduledAt: new Date(Date.now() + 5 * 60_000),
            failureCode: 'rate_limited_retry',
          },
          $inc: { scheduleAttempts: 1 },
        },
      );
      return 'retrying';
    }
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
    await markPostFailed(post, failureCode);
    await AuditLog.create({
      companyId: post.companyId,
      userId: publisher._id,
      action: 'SOCIAL_POST_PUBLISH_FAILED',
      resource: 'SocialPost',
      resourceId: post._id.toString(),
      details: { platform: adapter.id, failureCode, scheduled: true },
    });
    if (status === 401 || status === 403) {
      connection.status = 'error';
      connection.errorMessage = failureCode;
      await connection.save();
    }
    return 'failed';
  }
}

export const dispatchScheduledSocialPosts = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!isCronAuthorized(req)) {
    res.status(process.env.CRON_SECRET ? 401 : 503).json({
      success: false,
      message: process.env.CRON_SECRET
        ? 'Cron authorization failed.'
        : 'Scheduled publishing is not configured.',
    });
    return;
  }
  const due = await SocialPost.find({ status: 'scheduled', scheduledAt: { $lte: new Date() } })
    .sort({ scheduledAt: 1 })
    .limit(10)
    .select('_id')
    .lean();
  const results: Array<'published' | 'failed' | 'retrying' | 'skipped'> = [];
  for (const { _id } of due) {
    try {
      results.push(await publishScheduledPost(_id));
    } catch (error) {
      console.error('[SocialPublishing] Scheduled post processing failed.', {
        errorName: error instanceof Error ? error.name : 'UnknownError',
      });
      try {
        await SocialPost.updateOne(
          { _id, status: 'publishing' },
          { $set: { status: 'failed', failureCode: 'scheduler_error' } },
        );
      } catch (persistError) {
        console.error('[SocialPublishing] Scheduled failure state could not be persisted.', {
          errorName: persistError instanceof Error ? persistError.name : 'UnknownError',
        });
      }
      results.push('failed');
    }
  }
  res.json({
    success: true,
    processed: results.filter((result) => result !== 'skipped').length,
    published: results.filter((result) => result === 'published').length,
    failed: results.filter((result) => result === 'failed').length,
    retrying: results.filter((result) => result === 'retrying').length,
  });
};

export const generateSocialDraft = async (req: AuthRequest, res: Response): Promise<void> => {
  const topic = typeof req.body?.topic === 'string' ? req.body.topic.trim() : '';
  const details = typeof req.body?.details === 'string' ? req.body.details.trim() : '';
  const style = typeof req.body?.style === 'string' ? req.body.style : 'professional update';
  const operation = typeof req.body?.operation === 'string' ? req.body.operation : 'generate';
  const sourceText = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  const tone = typeof req.body?.tone === 'string' ? req.body.tone : 'professional';
  const platform = getProviderId(req.body?.platform);
  const adapter = getSocialProviderAdapter(platform);
  if (!adapter?.capabilities.publishText) {
    res.status(422).json({ success: false, code: 'PROVIDER_UNAVAILABLE', message: 'Tavro can only prepare drafts for configured publishing providers.' });
    return;
  }
  if ((operation === 'generate' ? !topic : !sourceText) ||
      !['generate', 'rewrite', 'shorten', 'improve', 'tone'].includes(operation) ||
      topic.length > 500 || details.length > 1500 || sourceText.length > LINKEDIN_TEXT_POST_MAX_LENGTH ||
      !['professional update', 'product announcement', 'marketing post', 'event promotion'].includes(style) ||
      !['professional', 'friendly', 'confident', 'informative'].includes(tone)) {
    res.status(400).json({ success: false, message: 'Provide a valid topic or draft, supported writing style, tone, and optional details within the length limits.' });
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
    const prompt = operation === 'generate'
      ? `Write a LinkedIn ${style} draft about this topic: ${topic}${details ? `\n\nUser-provided facts and context (do not add unsupported claims):\n${details}` : ''}`
      : `${operation === 'tone' ? 'Adjust the tone' : `${operation[0].toUpperCase()}${operation.slice(1)} this LinkedIn draft`} using a ${tone} tone. Preserve the user's factual claims and intent; do not add unsupported claims.\n\nDraft:\n${sourceText}${topic ? `\n\nAdditional direction: ${topic}` : ''}${details ? `\n\nUser-provided facts and context:\n${details}` : ''}`;
    const result = await runAgentTurn(
      `${prompt}\n\nReturn only the proposed post text, under 3000 characters. Do not publish, schedule, or claim any action was taken.`,
      [],
      {
        companyId: req.user!.companyId,
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
