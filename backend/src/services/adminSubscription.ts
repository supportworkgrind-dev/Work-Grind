import { Request } from 'express';
import mongoose from 'mongoose';
import Company, { CompanyPlan } from '../models/Company';
import AuditLog from '../models/AuditLog';
import { getPurchasablePlanIds } from '../config/subscription';
import { normalizeOrganizationType } from '../config/organization';
import { CompanySubscriptionInfo, getCompanySubscription } from './companySubscription';
import { emitToCompany } from '../utils/socket';

/**
 * Super-admin subscription changes. A change is stored as a manual grant on the
 * workspace (never as fake Polar billing data), resolved through the same
 * getCompanySubscription every member and feature check uses, audited with the
 * before/after state, and announced to the workspace so open sessions refetch.
 */

export const MAX_GRANT_DAYS = 5 * 366;
const REASON_MAX_LENGTH = 300;

export class AdminSubscriptionError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
    this.name = 'AdminSubscriptionError';
  }
}

export type AdminSubscriptionInput = {
  plan: unknown;
  expiresAt?: unknown;
  reason?: unknown;
};

export type SubscriptionSummary = {
  status: CompanySubscriptionInfo['status'];
  plan: CompanySubscriptionInfo['plan'];
  hasActiveAccess: boolean;
  accessSource: CompanySubscriptionInfo['accessSource'];
  expiresAt: string | null;
};

export function summarizeSubscription(subscription: CompanySubscriptionInfo): SubscriptionSummary {
  return {
    status: subscription.status,
    plan: subscription.plan,
    hasActiveAccess: subscription.hasActiveAccess,
    accessSource: subscription.accessSource,
    expiresAt: subscription.subscriptionEndDate ? subscription.subscriptionEndDate.toISOString() : null,
  };
}

/** Plans an admin may grant this workspace, plus 'free' to remove a grant. */
export function assignablePlansFor(organizationType: unknown): string[] {
  return [...getPurchasablePlanIds(normalizeOrganizationType(organizationType) ?? null), 'free'];
}

function parseExpiry(value: unknown, now: Date): Date | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const date = typeof value === 'string' || value instanceof Date ? new Date(value) : new Date(Number.NaN);
  if (Number.isNaN(date.getTime())) {
    throw new AdminSubscriptionError(400, 'INVALID_EXPIRY', 'Expiry must be a valid date.');
  }
  if (date.getTime() <= now.getTime()) {
    throw new AdminSubscriptionError(400, 'INVALID_EXPIRY', 'Expiry must be in the future.');
  }
  if (date.getTime() > now.getTime() + MAX_GRANT_DAYS * 86_400_000) {
    throw new AdminSubscriptionError(400, 'INVALID_EXPIRY', 'Expiry can be at most five years ahead.');
  }
  return date;
}

export async function applyAdminSubscriptionChange(
  companyId: string,
  input: AdminSubscriptionInput,
  actorId: string,
  req: Pick<Request, 'ip'>,
): Promise<{ company: { _id: string; name: string; organizationType: string }; previous: SubscriptionSummary; subscription: SubscriptionSummary }> {
  if (!mongoose.isValidObjectId(companyId)) {
    throw new AdminSubscriptionError(404, 'WORKSPACE_NOT_FOUND', 'Workspace not found.');
  }
  const company = await Company.findById(companyId);
  if (!company) throw new AdminSubscriptionError(404, 'WORKSPACE_NOT_FOUND', 'Workspace not found.');

  const allowed = assignablePlansFor(company.organizationType);
  if (typeof input.plan !== 'string' || !allowed.includes(input.plan)) {
    throw new AdminSubscriptionError(400, 'PLAN_NOT_ALLOWED',
      `This ${normalizeOrganizationType(company.organizationType) ?? 'unrecognized'} workspace can be given: ${allowed.join(', ')}.`);
  }
  const plan = input.plan as CompanyPlan | 'free';
  const now = new Date();
  const expiresAt = plan === 'free' ? undefined : parseExpiry(input.expiresAt, now);
  if (input.reason !== undefined && (typeof input.reason !== 'string' || input.reason.length > REASON_MAX_LENGTH)) {
    throw new AdminSubscriptionError(400, 'INVALID_REASON', `Reason must be text of at most ${REASON_MAX_LENGTH} characters.`);
  }
  const reason = typeof input.reason === 'string' && input.reason.trim() ? input.reason.trim() : undefined;

  const previous = summarizeSubscription(await getCompanySubscription(companyId));

  if (plan === 'free') {
    company.manualGrant = undefined;
    // Earlier admin edits wrote "active" straight into the billing fields with
    // no Polar subscription behind them; removing access must clear that too.
    // A real Polar subscription is left to Polar.
    if (!company.polarSubscriptionId && !company.isLifetime &&
        ['active', 'past_due', 'cancelled'].includes(company.subscriptionStatus)) {
      company.subscriptionStatus = 'expired';
      company.subscriptionEndDate = now;
    }
  } else {
    company.manualGrant = {
      plan: plan as CompanyPlan,
      grantedBy: new mongoose.Types.ObjectId(actorId),
      grantedAt: now,
      ...(expiresAt ? { expiresAt } : {}),
      ...(reason ? { reason } : {}),
    };
  }
  await company.save();

  const subscription = summarizeSubscription(await getCompanySubscription(companyId));

  try {
    await AuditLog.create({
      companyId: company._id,
      userId: actorId,
      action: 'ADMIN_SUBSCRIPTION_CHANGED',
      resource: 'Company',
      resourceId: company._id.toString(),
      details: { requestedPlan: plan, previous, next: subscription, ...(reason ? { reason } : {}) },
      ipAddress: req.ip,
    });
  } catch (error) {
    console.error('[AdminSubscription] Audit record could not be written.', {
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
  }
  // Members with an open session refetch their subscription right away.
  emitToCompany(company._id.toString(), 'subscription:updated', { hasActiveAccess: subscription.hasActiveAccess });

  return {
    company: { _id: company._id.toString(), name: company.name, organizationType: company.organizationType },
    previous,
    subscription,
  };
}
