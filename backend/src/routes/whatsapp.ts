import crypto from 'crypto';
import { Request, Response, Router } from 'express';

const router = Router();

const safeHeaderValue = (value: string | undefined): string | undefined => {
  if (!value) return undefined;
  return value.replace(/[^\w.-]/g, '').slice(0, 128) || undefined;
};

const getEventType = (payload: Record<string, unknown>): string | undefined => {
  const value = payload.event ?? payload.type ?? payload.event_type;
  return typeof value === 'string' ? value.replace(/[^\w.-]/g, '').slice(0, 100) || undefined : undefined;
};

const receiveWebhook = (req: Request, res: Response): void => {
  const requestId = safeHeaderValue(req.get('x-waapi-request-id'));
  const instanceId = safeHeaderValue(req.get('x-waapi-instance-id'));
  const logContext = {
    ...(requestId ? { requestId } : {}),
    ...(instanceId ? { instanceId } : {}),
  };
  const secret = process.env.WAAPI_WEBHOOK_SECRET?.trim();

  if (!secret) {
    console.error('[WhatsApp Webhook] Rejected: webhook secret is not configured.', {
      ...logContext,
      httpStatus: 503,
      reason: 'webhook_secret_missing',
    });
    res.status(503).json({ success: false, message: 'Webhook is not configured.' });
    return;
  }

  const signature = req.get('x-waapi-hmac') || '';
  const serializedPayload = JSON.stringify(req.body) ?? '';
  const expectedSignature = `sha256=${crypto
    .createHmac('sha256', secret)
    .update(serializedPayload)
    .digest('hex')}`;
  const receivedSignatureBuffer = Buffer.from(signature);
  const expectedSignatureBuffer = Buffer.from(expectedSignature);
  const signatureValid = receivedSignatureBuffer.length === expectedSignatureBuffer.length &&
    crypto.timingSafeEqual(receivedSignatureBuffer, expectedSignatureBuffer);

  if (!signatureValid) {
    console.warn('[WhatsApp Webhook] Rejected: invalid signature.', {
      ...logContext,
      httpStatus: 401,
      reason: 'invalid_signature',
    });
    res.status(401).json({ success: false, message: 'Invalid webhook signature.' });
    return;
  }

  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    console.warn('[WhatsApp Webhook] Rejected: invalid JSON payload shape.', {
      ...logContext,
      httpStatus: 400,
      reason: 'invalid_payload',
    });
    res.status(400).json({ success: false, message: 'Invalid webhook payload.' });
    return;
  }

  const eventType = getEventType(req.body as Record<string, unknown>);
  console.info('[WhatsApp Webhook] Accepted.', {
    ...logContext,
    ...(eventType ? { eventType } : {}),
    httpStatus: 200,
    reason: 'accepted',
  });
  res.status(200).json({ success: true });
};

router.post('/webhook', receiveWebhook);

export default router;
