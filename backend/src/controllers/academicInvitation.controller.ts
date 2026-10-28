import mongoose from 'mongoose';
import { Request, Response } from 'express';
import AcademicImportJob from '../models/AcademicImportJob';
import AcademicInvitation from '../models/AcademicInvitation';
import AcademicPerson, { AcademicPersonType } from '../models/AcademicPerson';
import Company from '../models/Company';
import User from '../models/User';
import { AuthRequest } from '../middleware/auth';
import {
  AcademicInvitationError,
  acceptAcademicInvitation,
  describeAcademicInvitation,
  displayStatus,
  isRetryable,
  MAX_INVITATIONS_PER_REQUEST,
  revokeAcademicInvitation,
  sendAcademicInvitations,
} from '../services/academicInvitation.service';
import { EmailProviderConfigurationError } from '../utils/email';
import { setRefreshCookie } from '../utils/authCookie';
import { sessionForUser } from './auth.controller';

const PERSON_TYPES: AcademicPersonType[] = ['student', 'teacher', 'parent'];
const LIST_STATUSES = ['pending', 'sent', 'failed', 'expired', 'accepted', 'revoked', 'not_invited'] as const;

function companyId(req: AuthRequest): mongoose.Types.ObjectId {
  return new mongoose.Types.ObjectId(req.user!.companyId);
}

function sendInvitationError(res: Response, error: unknown, fallback: string): void {
  if (error instanceof AcademicInvitationError) {
    res.status(error.status).json({ success: false, code: error.code, message: error.message });
    return;
  }
  if (error instanceof EmailProviderConfigurationError) {
    console.error('[AcademicInvitation] Email provider is not configured.', { missingVariables: error.missingVariables });
    res.status(503).json({
      success: false,
      code: 'EMAIL_NOT_CONFIGURED',
      message: 'Invitation emails cannot be sent because the email provider is not configured on the server. No invitations were sent.',
    });
    return;
  }
  console.error('[AcademicInvitation] Request failed.', { errorName: error instanceof Error ? error.name : 'UnknownError' });
  res.status(500).json({ success: false, message: fallback });
}

/**
 * Recipients come from exactly one selector: explicit people, the people an
 * import created or updated, or everyone of a type who is still uninvited or
 * whose invitation can be retried.
 */
async function resolveRecipients(req: AuthRequest): Promise<{ personIds?: mongoose.Types.ObjectId[]; importJobId?: mongoose.Types.ObjectId; error?: string }> {
  const tenantId = companyId(req);
  const body = req.body ?? {};
  const selectors = [body.personIds !== undefined, body.importJobId !== undefined, body.scope !== undefined].filter(Boolean).length;
  if (selectors !== 1) return { error: 'Choose the people to invite.' };
  if (body.personIds !== undefined) {
    if (!Array.isArray(body.personIds) || !body.personIds.length || body.personIds.length > MAX_INVITATIONS_PER_REQUEST || !body.personIds.every((id: unknown) => typeof id === 'string' && mongoose.isValidObjectId(id))) {
      return { error: `Choose between 1 and ${MAX_INVITATIONS_PER_REQUEST} people to invite.` };
    }
    return { personIds: body.personIds.map((id: string) => new mongoose.Types.ObjectId(id)) };
  }
  if (body.importJobId !== undefined) {
    if (typeof body.importJobId !== 'string' || !mongoose.isValidObjectId(body.importJobId)) return { error: 'Invalid import job identifier.' };
    const job = await AcademicImportJob.findOne({ _id: body.importJobId, companyId: tenantId }).select('_id personIds module');
    if (!job) return { error: 'Import job not found.' };
    return { personIds: job.personIds.slice(0, MAX_INVITATIONS_PER_REQUEST), importJobId: job._id as mongoose.Types.ObjectId };
  }
  if (!['uninvited', 'retryable'].includes(body.scope) || !PERSON_TYPES.includes(body.type)) return { error: 'Choose who to invite.' };
  const people = await AcademicPerson.find({ companyId: tenantId, type: body.type, status: 'active', email: { $type: 'string' }, $or: [{ userId: { $exists: false } }, { userId: null }] }).select('_id').lean();
  const invitations = await AcademicInvitation.find({ companyId: tenantId, personId: { $in: people.map((person) => person._id) } }).select('personId status expiresAt').lean();
  const byPerson = new Map(invitations.map((invitation) => [invitation.personId.toString(), invitation]));
  const selected = people.filter((person) => {
    const invitation = byPerson.get(person._id.toString());
    return body.scope === 'uninvited' ? !invitation : Boolean(invitation && isRetryable(invitation));
  });
  return { personIds: selected.slice(0, MAX_INVITATIONS_PER_REQUEST).map((person) => person._id as mongoose.Types.ObjectId) };
}

export const sendInvitations = async (req: AuthRequest, res: Response): Promise<void> => {
  if (req.body?.confirmed !== true) {
    res.status(400).json({ success: false, message: 'Confirm before sending invitation emails.' });
    return;
  }
  try {
    const recipients = await resolveRecipients(req);
    if (recipients.error || !recipients.personIds) {
      res.status(400).json({ success: false, message: recipients.error ?? 'Choose the people to invite.' });
      return;
    }
    if (!recipients.personIds.length) {
      res.json({ success: true, results: [], summary: { sent: 0, failed: 0, already_linked: 0, already_accepted: 0, no_email: 0, inactive: 0 } });
      return;
    }
    const outcome = await sendAcademicInvitations({
      companyId: companyId(req),
      userId: new mongoose.Types.ObjectId(req.user!.userId),
      personIds: recipients.personIds,
      importJobId: recipients.importJobId,
    });
    res.json({ success: true, ...outcome });
  } catch (error) {
    sendInvitationError(res, error, 'Unable to send invitations.');
  }
};

export const listInvitations = async (req: AuthRequest, res: Response): Promise<void> => {
  const tenantId = companyId(req);
  const type = PERSON_TYPES.includes(req.query.type as AcademicPersonType) ? req.query.type as AcademicPersonType : 'student';
  const status = LIST_STATUSES.includes(req.query.status as typeof LIST_STATUSES[number]) ? req.query.status as typeof LIST_STATUSES[number] : undefined;
  const pageValue = Number(req.query.page);
  const page = Number.isSafeInteger(pageValue) && pageValue > 0 ? pageValue : 1;
  const pageSize = 50;
  try {
    const people = await AcademicPerson.find({ companyId: tenantId, type })
      .select('_id externalId firstName lastName email status userId')
      .sort({ lastName: 1, firstName: 1 })
      .lean();
    const invitations = await AcademicInvitation.find({ companyId: tenantId, personId: { $in: people.map((person) => person._id) } })
      .select('_id personId status expiresAt sentAt sendAttempts lastError acceptedAt lastAttemptAt')
      .lean();
    const byPerson = new Map(invitations.map((invitation) => [invitation.personId.toString(), invitation]));
    const rows = people.map((person) => {
      const invitation = byPerson.get(person._id.toString());
      const invitationStatus = invitation ? displayStatus(invitation) : person.email ? 'not_invited' : 'no_email';
      return {
        personId: person._id,
        externalId: person.externalId,
        name: `${person.firstName} ${person.lastName}`,
        email: person.email,
        recordStatus: person.status,
        accountLinked: Boolean(person.userId),
        invitationId: invitation?._id,
        status: person.userId && invitationStatus !== 'accepted' ? 'linked' : invitationStatus,
        retryable: Boolean(!person.userId && person.status === 'active' && person.email && invitation && isRetryable(invitation)),
        sendAttempts: invitation?.sendAttempts ?? 0,
        sentAt: invitation?.sentAt,
        lastAttemptAt: invitation?.lastAttemptAt,
        expiresAt: invitation?.expiresAt,
        acceptedAt: invitation?.acceptedAt,
        lastError: invitation?.lastError,
      };
    });
    const summary: Record<string, number> = {};
    for (const row of rows) summary[row.status] = (summary[row.status] ?? 0) + 1;
    const filtered = status ? rows.filter((row) => row.status === status) : rows;
    res.json({
      success: true,
      type,
      summary,
      total: filtered.length,
      page,
      pageSize,
      invitations: filtered.slice((page - 1) * pageSize, page * pageSize),
    });
  } catch (error) {
    sendInvitationError(res, error, 'Unable to load onboarding status.');
  }
};

export const revokeInvitation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const revoked = await revokeAcademicInvitation(companyId(req), req.params.id, new mongoose.Types.ObjectId(req.user!.userId));
    if (!revoked) {
      res.status(404).json({ success: false, message: 'No revocable invitation was found.' });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    sendInvitationError(res, error, 'Unable to revoke the invitation.');
  }
};

export const getPublicInvitation = async (req: Request, res: Response): Promise<void> => {
  try {
    const invitation = await describeAcademicInvitation(req.params.token);
    if (!invitation) {
      res.status(404).json({ success: false, message: 'This invitation link is invalid, expired, or has already been used.' });
      return;
    }
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, invitation });
  } catch (error) {
    sendInvitationError(res, error, 'Unable to check this invitation.');
  }
};

export const acceptInvitation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const accepted = await acceptAcademicInvitation(req.body?.token, req.user!.userId);
    const [user, company] = await Promise.all([
      User.findById(req.user!.userId),
      Company.findById(accepted.companyId).select('_id name logo organizationType accountType ownerId'),
    ]);
    if (!user || !company) throw new Error('Accepted account or institution could not be reloaded.');
    // The session must carry the new workspace and role, so it is reissued.
    const session = await sessionForUser(user);
    setRefreshCookie(res, session.refreshToken);
    res.json({ success: true, accessToken: session.accessToken, user: session.user, company, role: accepted.role, joined: accepted.joined });
  } catch (error) {
    sendInvitationError(res, error, 'Unable to accept the invitation.');
  }
};
