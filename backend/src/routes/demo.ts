import { Router, Request, Response } from 'express';
import SupportTicket from '../models/SupportTicket';
import { sendDemoRequestEmail } from '../utils/email';

const router = Router();

router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, fullName, email, company, companyName, message, notes, requirements } = req.body;

    const finalName = (name || fullName || '').trim();
    const finalEmail = (email || '').toLowerCase().trim();
    const finalCompany = (company || companyName || '').trim();
    const finalMessage = (message || notes || requirements || '').trim();

    console.log('\n🎯 [Demo Request Submission] Received new request:');
    console.log(`   - Name: ${finalName}`);
    console.log(`   - Email: ${finalEmail}`);
    console.log(`   - Company: ${finalCompany || 'N/A'}`);
    console.log(`   - Message/Requirements: ${finalMessage || 'N/A'}`);

    if (!finalName || !finalEmail) {
      res.status(400).json({ success: false, message: 'Name and email are required' });
      return;
    }

    // 1. Save SupportTicket
    const ticket = await SupportTicket.create({
      type: 'demo',
      name: finalName,
      email: finalEmail,
      company: finalCompany || undefined,
      subject: `Demo Request from ${finalName}${finalCompany ? ` (${finalCompany})` : ''}`,
      message: finalMessage || 'Requesting a live WorkGrind demo walkthrough.',
      status: 'new',
      priority: 'high',
      isRead: false,
    });

    console.log(`✅ [Demo Request] Saved SupportTicket in DB with ID: ${ticket._id}`);

    // 2. Dispatch notification email
    const emailResult = await sendDemoRequestEmail({
      name: finalName,
      email: finalEmail,
      company: finalCompany || undefined,
      message: finalMessage || undefined,
    });

    console.log('📬 [Demo Request] Email dispatch outcome:', emailResult);

    res.status(201).json({
      success: true,
      message: "Thanks! We'll reach out to you soon.",
      ticketId: ticket._id,
      emailSent: emailResult.success,
    });
  } catch (err: any) {
    console.error('❌ [Demo Request] Error handling demo request:', err);
    res.status(500).json({ success: false, message: err.message || 'Internal server error' });
  }
});

export default router;
