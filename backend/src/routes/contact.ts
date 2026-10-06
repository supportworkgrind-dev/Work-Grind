import { Router, Request, Response } from 'express';
import SupportTicket from '../models/SupportTicket';
import { sendContactInquiryEmail } from '../utils/email';

const router = Router();

router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, fullName, email, company, companyName, subject, message, notes, type } = req.body;

    const finalName = (name || fullName || '').trim();
    const finalEmail = (email || '').toLowerCase().trim();
    const finalCompany = (company || companyName || '').trim();
    const finalMessage = (message || notes || '').trim();
    const finalSubject = (subject || (type === 'demo' ? 'Live Demo Walkthrough Request' : 'General Inquiry')).trim();
    const ticketType: 'contact' | 'demo' = type === 'demo' ? 'demo' : 'contact';

    console.log(`[Inquiry] Received ${ticketType} submission.`);

    if (!finalName || !finalEmail || (!finalMessage && ticketType === 'contact')) {
      console.warn('⚠️ [Inquiry Form] Validation failed: missing required fields');
      res.status(400).json({ success: false, message: 'Name, email, and message are required' });
      return;
    }

    // 1. Save SupportTicket in database
    const ticket = await SupportTicket.create({
      type: ticketType,
      name: finalName,
      email: finalEmail,
      company: finalCompany || undefined,
      subject: finalSubject,
      message: finalMessage || 'Requesting a live WorkGrind demo walkthrough.',
      status: 'new',
      priority: ticketType === 'demo' ? 'high' : 'medium',
      isRead: false,
    });
    console.log(`[Inquiry] Saved ${ticketType} submission.`);

    // 2. Dispatch configured support notification and user confirmation.
    let emailResult;
    if (ticketType === 'demo') {
      const { sendDemoRequestEmail } = await import('../utils/email');
      emailResult = await sendDemoRequestEmail({
        name: finalName,
        email: finalEmail,
        company: finalCompany || undefined,
        message: finalMessage || undefined,
      });
    } else {
      emailResult = await sendContactInquiryEmail({
        name: finalName,
        email: finalEmail,
        company: finalCompany || undefined,
        subject: finalSubject,
        message: finalMessage,
      });
    }

    if (!emailResult.success) {
      console.error('[Inquiry] Email notification failed:', emailResult.error);
      res.status(201).json({
        success: true,
        warning: 'Ticket saved, but email notification failed to dispatch.',
        message: ticketType === 'demo'
          ? "Thanks! We've recorded your demo request."
          : 'Your inquiry was recorded.',
      });
      return;
    }

    console.log('[Inquiry] Notification email dispatched.');

    res.status(201).json({
      success: true,
      message: ticketType === 'demo'
        ? "Thanks! We've recorded your demo request."
        : 'Thank you for contacting WorkGrind. Your message was recorded.',
      emailSent: true,
    });
  } catch (err: any) {
    console.error('❌ [Inquiry Form] Fatal error handling inquiry form:', err);
    res.status(500).json({ success: false, message: err.message || 'Internal server error' });
  }
});

export default router;
