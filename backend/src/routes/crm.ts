import { Router } from 'express';
import { authenticate, requireEntitlement } from '../middleware/auth';
import {
  // contacts
  getContacts, getContact, createContact, updateContact, deleteContact,
  // crm companies
  getCrmCompanies, getCrmCompany, getCrmCompanyConnectedWork, createCrmCompany, updateCrmCompany, deleteCrmCompany,
  // deals
  getDeals, getDeal, createDeal, updateDeal, deleteDeal, addDealActivity,
  // stats
  getPipelineStats,
} from '../controllers/crm.controller';

const router = Router();

// All CRM routes require authentication
router.use(authenticate, requireEntitlement('crm'));

// ── Pipeline stats ─────────────────────────────────────────────────────────────
router.get('/stats', getPipelineStats);

// ── Contacts ───────────────────────────────────────────────────────────────────
router.get   ('/contacts',          getContacts);
router.get   ('/contacts/:id',      getContact);
router.post  ('/contacts',          createContact);
router.patch ('/contacts/:id',      updateContact);
router.delete('/contacts/:id',      deleteContact);

// ── CRM Companies ──────────────────────────────────────────────────────────────
router.get   ('/companies',         getCrmCompanies);
router.get   ('/companies/:id/connected-work', getCrmCompanyConnectedWork);
router.get   ('/companies/:id',     getCrmCompany);
router.post  ('/companies',         createCrmCompany);
router.patch ('/companies/:id',     updateCrmCompany);
router.delete('/companies/:id',     deleteCrmCompany);

// ── Deals ─────────────────────────────────────────────────────────────────────
router.get   ('/deals',             getDeals);
router.get   ('/deals/:id',         getDeal);
router.post  ('/deals',             createDeal);
router.patch ('/deals/:id',         updateDeal);
router.delete('/deals/:id',         deleteDeal);
router.post  ('/deals/:id/activity', addDealActivity);

export default router;
