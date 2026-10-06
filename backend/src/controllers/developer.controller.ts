import { createHash, randomBytes } from 'crypto';
import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { DeveloperApiKey, DeveloperApiRequestLog, WebhookRegistration, CONNECT_SCOPES, type ConnectScope } from '../models/DeveloperAccess';
import { AuthRequest } from '../middleware/auth';

const VALID_SCOPES = new Set<string>(CONNECT_SCOPES);
const RATE_LIMIT = 120;

function newSecret() {
  const lookupId = randomBytes(8).toString('hex');
  const secret = `wg_live_${lookupId}_${randomBytes(32).toString('base64url')}`;
  return { lookupId, secret, secretHash: createHash('sha256').update(secret).digest('hex') };
}

function companyId(req: AuthRequest) {
  return new mongoose.Types.ObjectId(req.user!.companyId);
}

function publicKey(key: any) {
  return {
    id: key._id,
    name: key.name,
    prefix: `wg_live_${key.lookupId.slice(0, 6)}…`,
    scopes: key.scopes,
    createdAt: key.createdAt,
    lastUsedAt: key.lastUsedAt || null,
    rotatedAt: key.rotatedAt || null,
    revokedAt: key.revokedAt || null,
  };
}

export async function listApiKeys(req: AuthRequest, res: Response) {
  const keys = await DeveloperApiKey.find({ companyId: companyId(req) }).sort({ createdAt: -1 }).lean();
  res.json({ success: true, data: keys.map(publicKey), rateLimit: { requests: RATE_LIMIT, window: '1 minute' } });
}

export async function createApiKey(req: AuthRequest, res: Response) {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const scopes = req.body?.scopes;
  if (!name || name.length > 80 || !Array.isArray(scopes) || scopes.length === 0 || scopes.some((scope: unknown) => typeof scope !== 'string' || !VALID_SCOPES.has(scope))) {
    res.status(400).json({ success: false, message: 'Provide a name of 1–80 characters and at least one valid resource scope.' });
    return;
  }
  const generated = newSecret();
  const key = await DeveloperApiKey.create({
    companyId: companyId(req),
    createdBy: req.user!.userId,
    name,
    lookupId: generated.lookupId,
    secretHash: generated.secretHash,
    scopes: [...new Set(scopes)] as ConnectScope[],
  });
  res.status(201).json({ success: true, data: publicKey(key), secret: generated.secret, warning: 'Copy this key now. It cannot be viewed again.' });
}

export async function revokeApiKey(req: AuthRequest, res: Response) {
  const key = await DeveloperApiKey.findOneAndUpdate(
    { _id: req.params.id, companyId: companyId(req), revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date() } },
    { new: true },
  );
  if (!key) { res.status(404).json({ success: false, message: 'Active API key not found.' }); return; }
  res.json({ success: true, data: publicKey(key) });
}

export async function rotateApiKey(req: AuthRequest, res: Response) {
  const generated = newSecret();
  const key = await DeveloperApiKey.findOneAndUpdate(
    { _id: req.params.id, companyId: companyId(req), revokedAt: { $exists: false } },
    { $set: { lookupId: generated.lookupId, secretHash: generated.secretHash, rotatedAt: new Date() } },
    { new: true, runValidators: true },
  );
  if (!key) { res.status(404).json({ success: false, message: 'Active API key not found.' }); return; }
  res.json({ success: true, data: publicKey(key), secret: generated.secret, warning: 'The previous key was invalidated. Copy this new key now; it cannot be viewed again.' });
}

export async function listApiRequestLogs(req: AuthRequest, res: Response) {
  const page = Math.max(1, Number.parseInt(String(req.query.page || '1'), 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit || '50'), 10) || 50));
  const logs = await DeveloperApiRequestLog.find({ companyId: companyId(req) })
    .sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit)
    .populate('apiKeyId', 'name').lean();
  const total = await DeveloperApiRequestLog.countDocuments({ companyId: companyId(req) });
  res.json({ success: true, data: logs.map((log: any) => ({
    id: log._id,
    keyName: log.apiKeyId?.name || 'Revoked key',
    method: log.method,
    path: log.path,
    statusCode: log.statusCode,
    durationMs: log.durationMs,
    createdAt: log.createdAt,
  })), pagination: { page, limit, total } });
}

export async function listWebhooks(req: AuthRequest, res: Response) {
  const data = await WebhookRegistration.find({ companyId: companyId(req) }).sort({ createdAt: -1 }).lean();
  res.json({ success: true, data });
}

export async function createWebhook(req: AuthRequest, res: Response) {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const rawUrl = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
  const events = req.body?.events;
  let url: URL;
  try { url = new URL(rawUrl); } catch { res.status(400).json({ success: false, message: 'Provide a valid HTTPS webhook URL.' }); return; }
  if (!name || name.length > 80 || url.protocol !== 'https:' || url.username || url.password || !Array.isArray(events) || events.length === 0 || events.length > 30 || events.some((event: unknown) => typeof event !== 'string' || event.length > 100)) {
    res.status(400).json({ success: false, message: 'Provide a name, HTTPS URL, and one or more event names.' });
    return;
  }
  const webhook = await WebhookRegistration.create({ companyId: companyId(req), createdBy: req.user!.userId, name, url: url.toString(), events: [...new Set(events)] });
  res.status(201).json({ success: true, data: webhook, notice: 'Webhook configuration is saved, but external event delivery is not yet enabled.' });
}

export async function updateWebhook(req: AuthRequest, res: Response) {
  const updates: Record<string, unknown> = {};
  if (typeof req.body?.name === 'string' && req.body.name.trim().length > 0 && req.body.name.trim().length <= 80) updates.name = req.body.name.trim();
  if (typeof req.body?.isEnabled === 'boolean') updates.isEnabled = req.body.isEnabled;
  if (req.body?.events !== undefined) {
    if (!Array.isArray(req.body.events) || req.body.events.length === 0 || req.body.events.length > 30 || req.body.events.some((event: unknown) => typeof event !== 'string' || event.length > 100)) {
      res.status(400).json({ success: false, message: 'Events must be a non-empty list of event names.' });
      return;
    }
    updates.events = [...new Set(req.body.events)];
  }
  if (req.body?.url !== undefined) {
    try {
      const url = new URL(req.body.url);
      if (url.protocol !== 'https:' || url.username || url.password) throw new Error();
      updates.url = url.toString();
    } catch { res.status(400).json({ success: false, message: 'Webhook URL must use HTTPS.' }); return; }
  }
  const webhook = await WebhookRegistration.findOneAndUpdate(
    { _id: req.params.id, companyId: companyId(req) }, { $set: updates }, { new: true, runValidators: true },
  );
  if (!webhook) { res.status(404).json({ success: false, message: 'Webhook configuration not found.' }); return; }
  res.json({ success: true, data: webhook, notice: 'External event delivery is not yet enabled.' });
}

export async function deleteWebhook(req: AuthRequest, res: Response) {
  const webhook = await WebhookRegistration.findOneAndDelete({ _id: req.params.id, companyId: companyId(req) });
  if (!webhook) { res.status(404).json({ success: false, message: 'Webhook configuration not found.' }); return; }
  res.json({ success: true });
}

export function runDeveloperTest(req: Request, res: Response) {
  res.json({
    success: true,
    data: {
      message: 'Developer area session is valid. To test the external API, use a one-time-displayed API key with a scoped GET request.',
      endpoint: 'GET /api/v1/contacts?limit=5',
      rateLimit: { requests: RATE_LIMIT, window: '1 minute' },
    },
  });
}
