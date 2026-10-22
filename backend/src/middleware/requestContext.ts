import { Request } from 'express';
import { getEffectiveSubscription } from '../services/companySubscription';

/**
 * Per-request memo for values that authenticate and the route guards stacked
 * after it would otherwise each re-read from MongoDB (up to nine sequential
 * queries on chat/meeting routes). Entries live on the request object only, so
 * nothing is shared between requests, users or workspaces.
 */

export interface VerifiedMembership {
  userId: string;
  companyId: string;
  role: string;
  organizationType?: string;
  accountType?: string;
}

type EffectiveSubscription = Awaited<ReturnType<typeof getEffectiveSubscription>>;

interface RequestContext {
  membership?: VerifiedMembership;
  subscription?: { userId: string; promise: Promise<EffectiveSubscription> };
}

const contexts = new WeakMap<Request, RequestContext>();

function contextFor(req: Request): RequestContext {
  let ctx = contexts.get(req);
  if (!ctx) {
    ctx = {};
    contexts.set(req, ctx);
  }
  return ctx;
}

/** Recorded by authenticate after it has checked the user and their active workspace. */
export function rememberVerifiedMembership(req: Request, membership: VerifiedMembership): void {
  contextFor(req).membership = membership;
}

export function getVerifiedMembership(req: Request, userId: string): VerifiedMembership | undefined {
  const membership = contexts.get(req)?.membership;
  return membership?.userId === userId ? membership : undefined;
}

/** getEffectiveSubscription, resolved at most once per request and user. */
export function getRequestSubscription(req: Request, userId: string): Promise<EffectiveSubscription> {
  const ctx = contextFor(req);
  if (ctx.subscription?.userId !== userId) {
    const promise = getEffectiveSubscription(userId);
    // A failed lookup must not be replayed to later guards as a cached result.
    promise.catch(() => {
      if (ctx.subscription?.promise === promise) ctx.subscription = undefined;
    });
    ctx.subscription = { userId, promise };
  }
  return ctx.subscription.promise;
}
