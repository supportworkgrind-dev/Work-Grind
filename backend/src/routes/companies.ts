import { Router } from 'express';
import {
  getCompany,
  updateCompany,
  getCompanyMembers,
  removeMember,
  getCompanyStats,
  getCompanyInvites,
  revokeInvite,
  resendInvite,
  regenerateInviteCode,
} from '../controllers/company.controller';
import { inviteMember } from '../controllers/user.controller';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', getCompany);
router.patch('/', requireRole('owner', 'admin'), updateCompany);
router.get('/members', getCompanyMembers);
router.get('/invites', requireRole('owner', 'admin', 'manager'), getCompanyInvites);
router.post('/invite', requireRole('owner', 'admin', 'manager'), inviteMember);
router.delete('/invites/:token', requireRole('owner', 'admin'), revokeInvite);
router.post('/invites/:token/resend', requireRole('owner', 'admin', 'manager'), resendInvite);
router.post('/regenerate-invite-code', requireRole('owner', 'admin'), regenerateInviteCode);
router.delete('/members/:userId', requireRole('owner', 'admin'), removeMember);
router.get('/stats', getCompanyStats);

export default router;
