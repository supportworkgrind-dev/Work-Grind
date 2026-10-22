import { Request } from 'express';
import AuditLog from '../models/AuditLog';
import type { IUser } from '../models/User';

/** Account-security events shown to the member in Settings and to workspace admins in the audit trail. */
export const SECURITY_EVENT_ACTIONS = [
  'LOGIN_SUCCEEDED',
  'LOGIN_MFA_FAILED',
  'PASSWORD_CHANGED',
  'MFA_ENABLED',
  'MFA_DISABLED',
  'MFA_RECOVERY_CODES_REGENERATED',
  'SESSIONS_REVOKED',
  'SIGN_IN_PROVIDER_UNLINKED',
  'DATA_EXPORTED',
] as const;
export type SecurityEventAction = (typeof SECURITY_EVENT_ACTIONS)[number];

/** Records an event in the workspace audit trail; never blocks the action itself. */
export async function recordSecurityEvent(
  user: Pick<IUser, '_id' | 'companyId'>,
  action: SecurityEventAction,
  req: Request,
  details?: Record<string, unknown>,
): Promise<void> {
  if (!user.companyId) return; // audit records are workspace-scoped
  try {
    await AuditLog.create({
      companyId: user.companyId,
      userId: user._id,
      action,
      resource: 'User',
      resourceId: user._id.toString(),
      ...(details ? { details } : {}),
      ipAddress: req.ip,
    });
  } catch (error) {
    console.error('[AccountSecurity] Security event could not be recorded.', {
      action,
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
  }
}
