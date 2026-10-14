import { Request, Router } from 'express';
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
  (req, res, next) => {
    if (!Buffer.isBuffer((req as Request & { rawBody?: Buffer }).rawBody)) {
      res.status(400).json({ success: false, message: 'Invalid webhook body' });
      return;
    }
    next();
  },
  handleWebhook,
);

// ── Authenticated ─────────────────────────────────────────────────────────────
router.use(authenticate);

router.get('/status',      getSubscriptionStatus);
router.post('/checkout',    requireRole('owner', 'admin'), createCheckout);
router.post('/cancel',      requireRole('owner', 'admin'), cancelSubscription);
router.post('/change-plan', requireRole('owner', 'admin'), changeSubscriptionPlan);
router.post('/reactivate',  requireRole('owner', 'admin'), reactivateSubscription);

// Coupon redemption — owner/admin only (enforced inside controller)
router.post('/coupon',     requireRole('owner', 'admin'), redeemCoupon);

export default router;
