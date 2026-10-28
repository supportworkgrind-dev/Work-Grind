import crypto from 'crypto';
import mongoose from 'mongoose';
import AcademicInvitation, { IAcademicInvitation } from '../models/AcademicInvitation';
import AcademicPerson, { AcademicPersonType } from '../models/AcademicPerson';
import AuditLog from '../models/AuditLog';
import Channel from '../models/Channel';
import Company from '../models/Company';
import User from '../models/User';
import { isAcademicOrganizationType } from '../config/organization';
import { getCompanySubscription } from './companySubscription';
import { assertEmailDeliveryConfigured, EmailSendResult, sendAcademicInvitationEmail } from '../utils/email';

export const INVITATION_TTL_MS = 7 * 24 * 60 * 60_000;
export const MAX_INVITATIONS_PER_REQUEST = 500;
const SEND_CONCURRENCY = 4;

export type InvitationSender = typeof sendAcademicInvitationEmail;

export type InvitationOutcome =
  | 'sent'
  | 'failed'
  | 'already_linked'
  | 'already_accepted'
  | 'no_email'
  | 'inactive';

export class AcademicInvitationError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
    this.name = 'AcademicInvitationError';
  }
}

export function hashInvitationToken(token: string): string {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

export function createInvitationToken(): { token: string; tokenHash: string } {
  const token = crypto.randomBytes(32).toString('base64url');
  return { token, tokenHash: hashInvitationToken(token) };
}

function isWellFormedToken(token: unknown): token is string {
  return typeof token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(token);
}

export function roleForPersonType(type: AcademicPersonType): 'student' | 'teacher' | 'parent' {
  return type;
}

function roleLabel(type: AcademicPersonType): string {
  return type === 'parent' ? 'parent or guardian' : type;
}

/** Status shown to administrators; a sent invitation past its expiry is retryable. */
export function displayStatus(invitation: Pick<IAcademicInvitation, 'status' | 'expiresAt'>): string {
  if (invitation.status === 'sent' && invitation.expiresAt && invitation.expiresAt.getTime() <= Date.now()) return 'expired';
  return invitation.status;
}

export function isRetryable(invitation: Pick<IAcademicInvitation, 'status' | 'expiresAt'>): boolean {
  const status = displayStatus(invitation);
  return status === 'failed' || status === 'expired' || status === 'revoked' || status === 'pending';
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await task(items[index]);
    }
  }));
  return results;
}

/**
 * Creates (or rotates) one invitation per eligible person and emails it.
 * Statuses only become "sent" when the email provider accepted the recipient.
 */
export async function sendAcademicInvitations(options: {
  companyId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  personIds: mongoose.Types.ObjectId[];
  importJobId?: mongoose.Types.ObjectId;
  sender?: InvitationSender;
  checkConfiguration?: () => Promise<void>;
}): Promise<{ results: Array<{ personId: string; outcome: InvitationOutcome; error?: string }>; summary: Record<InvitationOutcome, number> }> {
  const { companyId, userId } = options;
  if (options.personIds.length > MAX_INVITATIONS_PER_REQUEST) {
    throw new AcademicInvitationError(400, 'TOO_MANY_RECIPIENTS', `Send at most ${MAX_INVITATIONS_PER_REQUEST} invitations at a time.`);
  }
  await (options.checkConfiguration ?? assertEmailDeliveryConfigured)();
  const company = await Company.findOne({ _id: companyId, isActive: true }).select('name organizationType').lean();
  if (!company || !isAcademicOrganizationType(company.organizationType)) {
    throw new AcademicInvitationError(403, 'NOT_ACADEMIC', 'Invitations require an active education organization.');
  }
  const people = await AcademicPerson.find({ companyId, _id: { $in: options.personIds } })
    .select('_id type firstName email status userId')
    .lean();
  const invitations = await AcademicInvitation.find({ companyId, personId: { $in: people.map((person) => person._id) } })
    .select('personId status')
    .lean();
  const invitationByPerson = new Map(invitations.map((invitation) => [invitation.personId.toString(), invitation]));
  const sender = options.sender ?? sendAcademicInvitationEmail;

  const results = await mapWithConcurrency(people, SEND_CONCURRENCY, async (person) => {
    const personId = person._id.toString();
    if (person.userId) return { personId, outcome: 'already_linked' as const };
    if (invitationByPerson.get(personId)?.status === 'accepted') return { personId, outcome: 'already_accepted' as const };
    if (person.status !== 'active') return { personId, outcome: 'inactive' as const };
    if (!person.email) return { personId, outcome: 'no_email' as const };

    const { token, tokenHash } = createInvitationToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + INVITATION_TTL_MS);
    // Rotating the token invalidates any earlier link for this person.
    const invitation = await AcademicInvitation.findOneAndUpdate(
      { companyId, personId: person._id, status: { $ne: 'accepted' } },
      {
        $set: {
          email: person.email,
          tokenHash,
          status: 'pending',
          expiresAt,
          lastAttemptAt: now,
          invitedBy: userId,
          ...(options.importJobId ? { importJobId: options.importJobId } : {}),
        },
        $unset: { lastError: 1 },
        $inc: { sendAttempts: 1 },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).catch((error) => {
      if ((error as { code?: number })?.code === 11000) return null;
      throw error;
    });
    if (!invitation) return { personId, outcome: 'already_accepted' as const };

    let delivery: EmailSendResult;
    try {
      delivery = await sender({
        email: person.email,
        firstName: person.firstName,
        institutionName: company.name,
        roleLabel: roleLabel(person.type),
        token,
        expiresAt,
      });
    } catch {
      delivery = { success: false, error: 'Email delivery failed.' };
    }
    if (delivery.success) {
      await AcademicInvitation.updateOne({ _id: invitation._id, tokenHash }, { $set: { status: 'sent', sentAt: new Date() } });
      return { personId, outcome: 'sent' as const };
    }
    const error = (delivery.error || 'Email delivery failed.').slice(0, 300);
    // The undelivered token is discarded so it can never be used.
    await AcademicInvitation.updateOne({ _id: invitation._id, tokenHash }, { $set: { status: 'failed', lastError: error }, $unset: { tokenHash: 1 } });
    return { personId, outcome: 'failed' as const, error };
  });

  const summary: Record<InvitationOutcome, number> = { sent: 0, failed: 0, already_linked: 0, already_accepted: 0, no_email: 0, inactive: 0 };
  for (const result of results) summary[result.outcome] += 1;
  await AuditLog.create({
    companyId,
    userId,
    action: 'academic.invitations.sent',
    resource: 'academic_invitation',
    ...(options.importJobId ? { resourceId: options.importJobId.toString() } : {}),
    details: { requested: options.personIds.length, ...summary },
  }).catch(() => undefined);
  return { results, summary };
}

export async function revokeAcademicInvitation(companyId: mongoose.Types.ObjectId, invitationId: string, userId: mongoose.Types.ObjectId): Promise<boolean> {
  if (!mongoose.isValidObjectId(invitationId)) return false;
  const result = await AcademicInvitation.updateOne(
    { _id: invitationId, companyId, status: { $in: ['pending', 'sent', 'failed'] } },
    { $set: { status: 'revoked' }, $unset: { tokenHash: 1 } },
  );
  if (result.modifiedCount) {
    await AuditLog.create({ companyId, userId, action: 'academic.invitation.revoked', resource: 'academic_invitation', resourceId: invitationId }).catch(() => undefined);
  }
  return result.modifiedCount > 0;
}

async function findUsableInvitation(token: unknown) {
  if (!isWellFormedToken(token)) return null;
  return AcademicInvitation.findOne({
    tokenHash: hashInvitationToken(token),
    status: 'sent',
    expiresAt: { $gt: new Date() },
  });
}

/** Public details for a valid invitation link: only what the recipient needs to continue. */
export async function describeAcademicInvitation(token: unknown) {
  const invitation = await findUsableInvitation(token);
  if (!invitation) return null;
  const [company, person] = await Promise.all([
    Company.findOne({ _id: invitation.companyId, isActive: true }).select('name logo organizationType').lean(),
    AcademicPerson.findOne({ _id: invitation.personId, companyId: invitation.companyId, status: 'active' }).select('type firstName').lean(),
  ]);
  if (!company || !person || !isAcademicOrganizationType(company.organizationType)) return null;
  return {
    institutionName: company.name,
    institutionLogo: company.logo,
    organizationType: company.organizationType,
    role: roleForPersonType(person.type),
    firstName: person.firstName,
    email: invitation.email,
    expiresAt: invitation.expiresAt,
  };
}

/**
 * Accepts an invitation for a signed-in, verified account whose email matches
 * the invited address, links the account to the academic record, and adds the
 * account to the institution when it does not belong to one yet.
 */
export async function acceptAcademicInvitation(token: unknown, userId: string): Promise<{ companyId: string; personId: string; role: string; joined: boolean }> {
  const invitation = await findUsableInvitation(token);
  if (!invitation) throw new AcademicInvitationError(410, 'INVITATION_INVALID', 'This invitation link is invalid, expired, or has already been used.');
  const companyId = invitation.companyId;

  const user = await User.findById(userId).select('email companyId role isActive isVerified isDeleted');
  if (!user || !user.isActive || !user.isVerified || user.isDeleted) {
    throw new AcademicInvitationError(403, 'ACCOUNT_NOT_ELIGIBLE', 'Verify your email address before accepting this invitation.');
  }
  if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
    throw new AcademicInvitationError(403, 'EMAIL_MISMATCH', 'This invitation was sent to a different email address. Sign in with the invited email.');
  }
  const company = await Company.findOne({ _id: companyId, isActive: true }).select('organizationType');
  if (!company || !isAcademicOrganizationType(company.organizationType)) {
    throw new AcademicInvitationError(410, 'INVITATION_INVALID', 'This invitation link is invalid, expired, or has already been used.');
  }
  if (user.companyId && user.companyId.toString() !== companyId.toString()) {
    throw new AcademicInvitationError(409, 'OTHER_WORKSPACE', 'This account already belongs to another workspace. Use a different account or leave that workspace first.');
  }
  const person = await AcademicPerson.findOne({ _id: invitation.personId, companyId, status: 'active' }).select('_id type userId');
  if (!person) throw new AcademicInvitationError(410, 'INVITATION_INVALID', 'This invitation link is invalid, expired, or has already been used.');
  if (person.userId && person.userId.toString() !== user._id.toString()) {
    throw new AcademicInvitationError(409, 'ALREADY_LINKED', 'This record is already linked to another account.');
  }
  if (await AcademicPerson.exists({ companyId, userId: user._id, type: person.type, _id: { $ne: person._id } })) {
    throw new AcademicInvitationError(409, 'ACCOUNT_ALREADY_LINKED', `This account is already linked to another ${person.type} record in this institution.`);
  }
  const joining = !user.companyId;
  if (joining) {
    // The academic record already counts against the plan, so linking it needs no new seat.
    const subscription = await getCompanySubscription(companyId.toString());
    if (!subscription.hasActiveAccess) {
      throw new AcademicInvitationError(403, 'SUBSCRIPTION_REQUIRED', 'The institution needs an active WorkGrind subscription before new members can join.');
    }
  }

  const tokenHash = invitation.tokenHash!;
  const claimed = await AcademicInvitation.findOneAndUpdate(
    { _id: invitation._id, tokenHash, status: 'sent', expiresAt: { $gt: new Date() } },
    { $set: { status: 'accepted', acceptedAt: new Date(), acceptedUserId: user._id }, $unset: { tokenHash: 1 } },
    { new: true },
  );
  if (!claimed) throw new AcademicInvitationError(410, 'INVITATION_INVALID', 'This invitation link is invalid, expired, or has already been used.');
  const releaseClaim = () => AcademicInvitation.updateOne(
    { _id: invitation._id, status: 'accepted', acceptedUserId: user._id },
    { $set: { status: 'sent', tokenHash }, $unset: { acceptedAt: 1, acceptedUserId: 1 } },
  ).catch(() => undefined);

  let linked;
  try {
    linked = await AcademicPerson.updateOne(
      { _id: person._id, companyId, status: 'active', $or: [{ userId: { $exists: false } }, { userId: null }, { userId: user._id }] },
      { $set: { userId: user._id } },
    );
  } catch (error) {
    await releaseClaim();
    if ((error as { code?: number })?.code === 11000) {
      throw new AcademicInvitationError(409, 'ACCOUNT_ALREADY_LINKED', `This account is already linked to another ${person.type} record in this institution.`);
    }
    throw error;
  }
  if (!linked.matchedCount) {
    await releaseClaim();
    throw new AcademicInvitationError(409, 'ALREADY_LINKED', 'This record is already linked to another account.');
  }

  const role = joining ? roleForPersonType(person.type) : user.role;
  if (joining) {
    const joined = await User.updateOne(
      { _id: user._id, $or: [{ companyId: { $exists: false } }, { companyId: null }] },
      { $set: { companyId, role } },
    );
    if (!joined.modifiedCount) {
      await AcademicPerson.updateOne({ _id: person._id, companyId, userId: user._id }, { $unset: { userId: 1 } }).catch(() => undefined);
      await releaseClaim();
      throw new AcademicInvitationError(409, 'OTHER_WORKSPACE', 'This account already belongs to another workspace. Use a different account or leave that workspace first.');
    }
    await Channel.updateMany({ companyId, isDefault: true }, { $addToSet: { members: user._id } }).catch(() => undefined);
  }
  await AuditLog.create({
    companyId,
    userId: user._id,
    action: 'academic.invitation.accepted',
    resource: 'academic_invitation',
    resourceId: invitation._id.toString(),
    details: { personId: person._id.toString(), personType: person.type, joinedWorkspace: joining },
  }).catch(() => undefined);
  return { companyId: companyId.toString(), personId: person._id.toString(), role, joined: joining };
}
