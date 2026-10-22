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
import { requireOrganizationFeature, requireWorkspaceAdministrator } from '../middleware/organizationAccess';

const router = Router();

router.use(authenticate);

router.get('/', getCompany);
router.patch('/', requireRole('owner', 'admin', 'principal'), requireOrganizationFeature('workspaceSettings'), requireWorkspaceAdministrator, updateCompany);
router.get('/members', requireOrganizationFeature('memberDirectory'), getCompanyMembers);
router.get('/invites', requireRole('owner', 'admin', 'manager', 'principal'), requireOrganizationFeature('memberDirectory'), getCompanyInvites);
router.post('/invite', requireRole('owner', 'admin', 'manager', 'principal'), requireOrganizationFeature('memberDirectory'), inviteMember);
router.delete('/invites/:token', requireRole('owner', 'admin', 'principal'), requireOrganizationFeature('memberDirectory'), requireWorkspaceAdministrator, revokeInvite);
router.post('/invites/:token/resend', requireRole('owner', 'admin', 'manager', 'principal'), requireOrganizationFeature('memberDirectory'), resendInvite);
router.post('/regenerate-invite-code', requireRole('owner', 'admin', 'principal'), requireOrganizationFeature('memberDirectory'), requireWorkspaceAdministrator, regenerateInviteCode);
router.delete('/members/:userId', requireRole('owner', 'admin'), requireOrganizationFeature('memberDirectory'), requireWorkspaceAdministrator, removeMember);
router.get('/stats', requireOrganizationFeature('memberDirectory'), getCompanyStats);

export default router;
