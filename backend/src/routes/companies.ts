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
import { requireOrganizationFeature } from '../middleware/organizationAccess';
import { invalidateAnalyticsOverviewCache } from '../middleware/invalidateAnalyticsCache';

const router = Router();

router.use(authenticate);
router.use(invalidateAnalyticsOverviewCache);

router.get('/', getCompany);
router.patch('/', requireRole('owner', 'admin', 'principal'), requireOrganizationFeature('workspaceSettings'), updateCompany);
router.get('/members', requireOrganizationFeature('memberDirectory'), getCompanyMembers);
router.get('/invites', requireRole('owner', 'admin', 'manager', 'principal'), requireOrganizationFeature('memberDirectory'), getCompanyInvites);
router.post('/invite', requireRole('owner', 'admin', 'manager', 'principal'), requireOrganizationFeature('memberDirectory'), inviteMember);
router.delete('/invites/:token', requireRole('owner', 'admin', 'principal'), requireOrganizationFeature('memberDirectory'), revokeInvite);
router.post('/invites/:token/resend', requireRole('owner', 'admin', 'manager', 'principal'), requireOrganizationFeature('memberDirectory'), resendInvite);
router.post('/regenerate-invite-code', requireRole('owner', 'admin', 'principal'), requireOrganizationFeature('memberDirectory'), regenerateInviteCode);
router.delete('/members/:userId', requireRole('owner', 'admin'), requireOrganizationFeature('memberDirectory'), removeMember);
router.get('/stats', requireOrganizationFeature('memberDirectory'), getCompanyStats);

export default router;
