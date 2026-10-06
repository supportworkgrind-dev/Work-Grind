import { Router } from 'express';
import express from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import {
  getPlans,
  getSubscriptionStatus,
  createCheckout,
  cancelSubscription,
  changeSubscriptionPlan,
  reactivateSubscription,
  handleWebhook,
  redeemCoupon,
} from '../controllers/subscription.controller';

const router = Router();

// ── Public ────────────────────────────────────────────────────────────────────
router.get('/plans', getPlans);

// ── Webhook — raw body required for HMAC signature verification ───────────────
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  (req, _res, next) => {
    (req as any).rawBody = req.body;
    try { req.body = JSON.parse((req as any).rawBody.toString('utf8')); } catch { /* keep raw */ }
    next();
  },
  handleWebhook,
);

// ── Authenticated ─────────────────────────────────────────────────────────────
router.use(authenticate);

router.get('/status',      getSubscriptionStatus);
router.post('/checkout',   createCheckout);
router.post('/cancel',     cancelSubscription);
router.post('/change-plan', changeSubscriptionPlan);
router.post('/reactivate', reactivateSubscription);

// Coupon redemption — owner/admin only (enforced inside controller)
router.post('/coupon',     redeemCoupon);

export default router;
