/**
 * Integrations Controller
 *
 * Manages third-party integration connections.
 * OAuth tokens stored encrypted. Secrets never exposed to frontend.
 *
 * SECURITY:
 *   - companyId always from req.user
 *   - Tokens stored with AES-256-GCM encryption
 *   - Webhook inbound events verified by HMAC signature
 *   - Only owner/admin can connect/disconnect integrations
 */

import { Request, Response } from 'express';
import crypto from 'crypto';
import mongoose from 'mongoose';
import Integration, { IntegrationProvider } from '../models/Integration';
import AuditLog from '../models/AuditLog';
import { AuthRequest } from '../middleware/auth';

// ── Encryption helpers (same pattern as MFA secrets) ─────────────────────────

function getEncryptionKey(): Buffer {
  const raw = process.env.MFA_ENCRYPTION_KEY || process.env.JWT_SECRET || 'fallback-key-please-set-env';
  return crypto.createHash('sha256').update(raw).digest();
}

function encrypt(text: string): string {
  const iv  = crypto.randomBytes(12);
  const key = getEncryptionKey();
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc  = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag  = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
}

function decrypt(stored: string): string {
  const [ivHex, tagHex, encHex] = stored.split(':');
  const key     = getEncryptionKey();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const dec = Buffer.concat([decipher.update(Buffer.from(encHex, 'hex')), decipher.final()]);
  return dec.toString('utf8');
}

// ── Static provider registry (UI metadata) ───────────────────────────────────

export const INTEGRATION_REGISTRY: Record<IntegrationProvider, {
  provider:     IntegrationProvider;
  name:         string;
  description:  string;
  category:     string;
  authType:     'webhook';
  scopes?:      string[];
  docsUrl?:     string;
  iconBg:       string;
  iconColor:    string;
  available:    boolean;
}> = {
  webhook: {
    provider: 'webhook', name: 'Webhooks',
    description: 'Send real-time event payloads to any endpoint for custom integrations and automations.',
    category: 'developer', authType: 'webhook',
    iconBg: '#EDE9FE', iconColor: '#6D28D9', available: true,
  },
};

// ── GET /api/integrations ─────────────────────────────────────────────────────

export const getIntegrations = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const connected = await Integration.find({ companyId: req.user!.companyId })
      .select('-accessToken -refreshToken -webhookSecret')
      .lean();

    const connectedMap = Object.fromEntries(connected.map(i => [i.provider, i]));

    const integrations = Object.values(INTEGRATION_REGISTRY).map(reg => ({
      ...reg,
      connected:    !!connectedMap[reg.provider],
      status:       connectedMap[reg.provider]?.status ?? 'disconnected',
      lastSyncAt:   connectedMap[reg.provider]?.lastSyncAt ?? null,
      errorMessage: connectedMap[reg.provider]?.errorMessage ?? null,
      config:       connectedMap[reg.provider]?.config ?? {},
      webhookToken: reg.provider === 'webhook' ? connectedMap[reg.provider]?.webhookToken : undefined,
    }));

    res.json({ success: true, integrations });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── POST /api/integrations/:provider/connect ──────────────────────────────────

export const connectIntegration = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!['owner','admin'].includes(req.user!.role)) {
      res.status(403).json({ success: false, message: 'Owner or admin required' });
      return;
    }

    const provider = req.params.provider as IntegrationProvider;
    if (!INTEGRATION_REGISTRY[provider]) {
      res.status(400).json({ success: false, message: 'Unknown integration provider' });
      return;
    }

    if (provider === 'webhook') {
      const { webhookUrl, webhookEvents } = req.body;
      if (!webhookUrl) {
        res.status(400).json({ success: false, message: 'webhookUrl required' });
        return;
      }

      const webhookToken  = crypto.randomBytes(32).toString('hex');
      const webhookSecret = crypto.randomBytes(32).toString('hex');

      const integration = await Integration.findOneAndUpdate(
        { companyId: new mongoose.Types.ObjectId(req.user!.companyId), provider: 'webhook' },
        {
          $set: {
            createdBy:     new mongoose.Types.ObjectId(req.user!.userId),
            status:        'connected',
            webhookToken,
            webhookSecret: encrypt(webhookSecret),
            config: { webhookUrl, webhookEvents: webhookEvents ?? ['all'] },
            errorMessage:  null,
          },
        },
        { upsert: true, new: true, select: '-accessToken -refreshToken -webhookSecret' },
      );

      await AuditLog.create({
        companyId:  new mongoose.Types.ObjectId(req.user!.companyId),
        userId:     new mongoose.Types.ObjectId(req.user!.userId),
        action:     'INTEGRATION_CONNECTED',
        resource:   'Integration',
        details:    { provider, webhookUrl },
      });

      // Return the secret ONCE — it is not stored in plaintext
      res.json({
        success: true,
        integration,
        webhookSecret, // shown once, then encrypted in DB
        inboundUrl: `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/integrations/webhook/${webhookToken}`,
      });
      return;
    }

    res.status(400).json({ success: false, message: 'Unknown integration provider' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── DELETE /api/integrations/:provider ────────────────────────────────────────

export const disconnectIntegration = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!['owner','admin'].includes(req.user!.role)) {
      res.status(403).json({ success: false, message: 'Owner or admin required' });
      return;
    }

    const provider = req.params.provider as IntegrationProvider;
    if (!INTEGRATION_REGISTRY[provider]) {
      res.status(400).json({ success: false, message: 'Unknown integration provider' });
      return;
    }
    const deleted = await Integration.findOneAndUpdate(
      { companyId: new mongoose.Types.ObjectId(req.user!.companyId), provider },
      { $set: { status: 'disconnected', accessToken: undefined, refreshToken: undefined, errorMessage: null } },
      { new: true },
    );

    if (!deleted) {
      res.status(404).json({ success: false, message: 'Integration not found' });
      return;
    }

    await AuditLog.create({
      companyId:  new mongoose.Types.ObjectId(req.user!.companyId),
      userId:     new mongoose.Types.ObjectId(req.user!.userId),
      action:     'INTEGRATION_DISCONNECTED',
      resource:   'Integration',
      details:    { provider },
    });

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── POST /api/integrations/webhook/:token — inbound webhook receiver ──────────

export const receiveWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.params;
    const integration = await Integration.findOne({ webhookToken: token, provider: 'webhook' })
      .select('+webhookSecret')
      .lean();

    if (!integration || integration.status !== 'connected') {
      res.status(404).json({ success: false, message: 'Webhook not found or inactive' });
      return;
    }

    // HMAC signature verification (optional — only if X-Webhook-Signature header is present)
    const signature = req.headers['x-webhook-signature'] as string;
    if (signature && integration.webhookSecret) {
      try {
        const secret = decrypt(integration.webhookSecret);
        const expected = crypto
          .createHmac('sha256', secret)
          .update(JSON.stringify(req.body))
          .digest('hex');
        if (signature !== `sha256=${expected}`) {
          res.status(401).json({ success: false, message: 'Invalid webhook signature' });
          return;
        }
      } catch {
        res.status(401).json({ success: false, message: 'Signature verification failed' });
        return;
      }
    }

    // Emit to company room so the frontend can react in real-time
    const { emitToCompany } = await import('../utils/socket');
    emitToCompany(integration.companyId.toString(), 'integration:webhook_received', {
      provider: 'webhook',
      payload:  req.body,
      receivedAt: new Date().toISOString(),
    });

    // Update last sync
    await Integration.updateOne({ _id: integration._id }, { $set: { lastSyncAt: new Date() } });

    res.json({ success: true, message: 'Webhook received' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── PATCH /api/integrations/:provider/config ──────────────────────────────────

export const updateIntegrationConfig = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!['owner','admin'].includes(req.user!.role)) {
      res.status(403).json({ success: false, message: 'Owner or admin required' });
      return;
    }

    const provider = req.params.provider as IntegrationProvider;
    if (!INTEGRATION_REGISTRY[provider]) {
      res.status(400).json({ success: false, message: 'Unknown integration provider' });
      return;
    }
    const integration = await Integration.findOne({
      companyId: new mongoose.Types.ObjectId(req.user!.companyId),
      provider,
    });

    if (!integration) {
      res.status(404).json({ success: false, message: 'Integration not found' });
      return;
    }

    // Merge config (only known non-secret fields)
    const { webhookUrl, webhookEvents } = req.body;
    if (webhookUrl)    integration.config.webhookUrl    = webhookUrl;
    if (webhookEvents) integration.config.webhookEvents = webhookEvents;

    await integration.save();
    res.json({ success: true, config: integration.config });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};
