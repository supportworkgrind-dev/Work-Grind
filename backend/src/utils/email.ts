import nodemailer from 'nodemailer';
import { escapeHtml } from '../services/pendingRegistration';

let transporter: nodemailer.Transporter | null = null;

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export class EmailProviderConfigurationError extends Error {
  readonly missingVariables: string[];

  constructor(missingVariables: string[]) {
    super('Email provider configuration is incomplete or invalid.');
    this.name = 'EmailProviderConfigurationError';
    this.missingVariables = missingVariables;
  }
}

export const createSmtpTransporter = (
  env: NodeJS.ProcessEnv = process.env,
): nodemailer.Transporter => {
  const host = env.SMTP_HOST?.trim();
  const portValue = env.SMTP_PORT?.trim();
  const port = portValue ? Number(portValue) : NaN;
  const user = env.SMTP_USER?.trim() || env.EMAIL_USER?.trim();
  const pass = env.SMTP_PASS || env.EMAIL_PASS;
  const missingVariables: string[] = [];

  if (!host) missingVariables.push('SMTP_HOST');
  if (!portValue || !Number.isInteger(port) || port < 1 || port > 65535) missingVariables.push('SMTP_PORT');
  if (!user) missingVariables.push('SMTP_USER or EMAIL_USER');
  if (!pass) missingVariables.push('SMTP_PASS or EMAIL_PASS');

  const fromEmail = env.FROM_EMAIL?.trim() || user || '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromEmail)) missingVariables.push('FROM_EMAIL (or a valid SMTP_USER)');
  if (missingVariables.length) throw new EmailProviderConfigurationError(missingVariables);

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    requireTLS: port !== 465,
    auth: { user, pass },
    connectionTimeout: 15_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
    tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
  });
};

export const getTransporter = async (): Promise<nodemailer.Transporter> => {
  if (transporter) return transporter;
  transporter = createSmtpTransporter();
  return transporter;
};

export const closeEmailTransporter = (): void => {
  transporter?.close();
  transporter = null;
};

const getFromAddress = () => {
  const fromName = (process.env.FROM_NAME || 'WorkGrind').replace(/[\r\n"]/g, '').trim();
  const fromEmail = process.env.FROM_EMAIL?.trim() || process.env.SMTP_USER?.trim() ||
    process.env.EMAIL_USER?.trim();
  if (!fromEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromEmail)) {
    throw new EmailProviderConfigurationError(['FROM_EMAIL (or a valid SMTP_USER)']);
  }
  return `"${fromName}" <${fromEmail}>`;
};

const getBaseUrl = () => process.env.CLIENT_URL || 'http://localhost:3000';

const logEmailError = (messageType: string, stage: string, error: unknown) => {
  const fields = error && typeof error === 'object' ? error as Record<string, unknown> : {};
  const code = typeof fields.code === 'string' && /^[A-Z0-9_]+$/i.test(fields.code)
    ? fields.code
    : undefined;
  const command = typeof fields.command === 'string' && /^[A-Z_]+$/i.test(fields.command)
    ? fields.command
    : undefined;
  const responseCode = Number.isInteger(fields.responseCode) ? fields.responseCode : undefined;
  const missingVariables = error instanceof EmailProviderConfigurationError
    ? error.missingVariables
    : undefined;
  console.error('[Email Service] Email delivery failed.', {
    messageType,
    provider: 'smtp',
    stage,
    ...(code ? { code } : {}),
    ...(command ? { command } : {}),
    ...(responseCode ? { responseCode } : {}),
    ...(missingVariables ? { missingVariables } : {}),
  });
};

// ─── Branded HTML Wrapper ──────────────────────────────────────────────────
const emailWrapper = (content: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>WorkGrind</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1e3a5f 0%,#2563eb 100%);border-radius:16px 16px 0 0;padding:32px 40px;text-align:center;">
            <div style="display:inline-flex;align-items:center;gap:10px;">
              <svg width="44" height="44" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="wg-em" x1="4" y1="28" x2="52" y2="28" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stop-color="#818cf8"/>
                    <stop offset="48%" stop-color="#a78bfa"/>
                    <stop offset="100%" stop-color="#60a5fa"/>
                  </linearGradient>
                  <linearGradient id="wg-ed" x1="24" y1="5" x2="32" y2="12" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stop-color="#c4b5fd"/>
                    <stop offset="100%" stop-color="#93c5fd"/>
                  </linearGradient>
                </defs>
                <polyline points="4,46 15,16 22,34 28,8 34,34 41,16 52,46" stroke="url(#wg-em)" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                <circle cx="28" cy="8" r="2.8" fill="url(#wg-ed)"/>
              </svg>
              <span style="font-size:22px;font-weight:900;color:#ffffff;letter-spacing:-0.04em;">WorkGrind</span>
            </div>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="background:#ffffff;padding:40px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
            ${content}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 16px 16px;padding:24px 40px;text-align:center;">
            <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.6;">
              WorkGrind
            </p>
            <p style="margin:8px 0 0;color:#cbd5e1;font-size:11px;">
              © ${new Date().getFullYear()} WorkGrind. All rights reserved.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
`;

// ─── Safe Internal Dispatcher (Never logs credentials) ────────────────────────
const safeSend = async (
  to: string,
  subject: string,
  html: string,
  replyTo?: string,
  messageType = 'transactional',
): Promise<EmailSendResult> => {
  try {
    const from = getFromAddress();
    const t = await getTransporter();
    const info = await t.sendMail({ from, to, subject, html, replyTo });
    const accepted = Array.isArray(info.accepted) && info.accepted.some((recipient: string | { address: string }) => {
      const address = typeof recipient === 'string' ? recipient : recipient.address;
      return address.toLowerCase() === to.toLowerCase();
    });
    if (!accepted) {
      console.error('[Email Service] Provider did not accept the recipient.', {
        messageType,
        provider: 'smtp',
        stage: 'recipient_acceptance',
        rejectedRecipientCount: Array.isArray(info.rejected) ? info.rejected.length : undefined,
      });
      return { success: false, error: 'Email provider did not accept the recipient.' };
    }
    return { success: true, messageId: info.messageId };
  } catch (error) {
    logEmailError(
      messageType,
      error instanceof EmailProviderConfigurationError ? 'configuration' : 'send',
      error,
    );
    return { success: false, error: 'Email delivery failed.' };
  }
};

// ─── 1. Email Verification ───────────────────────────────────────────────────
export const sendVerificationEmail = async (email: string, name: string, token: string) => {
  try {
    const safeName = escapeHtml(name);
    const link = `${getBaseUrl()}/verify-email?token=${encodeURIComponent(token)}`;
    const html = emailWrapper(`
    <h2 style="margin:0 0 8px;color:#0f172a;font-size:24px;font-weight:800;">Verify your email ✉️</h2>
    <p style="margin:0 0 24px;color:#64748b;font-size:15px;">Hi <strong>${safeName}</strong>, welcome to WorkGrind! Click the button below to verify your email address.</p>
    <div style="text-align:center;margin:32px 0;">
      <a href="${link}" style="display:inline-block;background:#2563eb;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:12px;">
        Verify Email Address
      </a>
    </div>
    <p style="margin:0;color:#94a3b8;font-size:13px;">This link expires in <strong>24 hours</strong>. If you didn't create an account, you can safely ignore this email.</p>
    `);
    return safeSend(email, 'Verify your WorkGrind account', html, undefined, 'email_verification');
  } catch (error) {
    logEmailError('email_verification', 'configuration', error);
    return { success: false, error: 'Email delivery failed.' };
  }
};

export const sendVerificationCodeEmail = async (email: string, name: string, code: string) => {
  const safeName = escapeHtml(name);
  const html = emailWrapper(`
    <h2 style="margin:0 0 8px;color:#0f172a;font-size:24px;font-weight:800;">Your WorkGrind verification code</h2>
    <p style="margin:0 0 20px;color:#64748b;font-size:15px;">Hi <strong>${safeName}</strong>, enter this code to verify your email and finish creating your account.</p>
    <div style="margin:28px 0;padding:20px;text-align:center;background:#f8f6f2;border:1px solid #e7e2d8;">
      <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:32px;font-weight:800;letter-spacing:10px;color:#202820;">${code}</span>
    </div>
    <p style="margin:0;color:#64748b;font-size:13px;">This code expires in <strong>10 minutes</strong>. If you didn't request it, you can safely ignore this email.</p>
  `);
  return safeSend(email, 'Your WorkGrind verification code', html, undefined, 'registration_verification_code');
};

// ─── 2. Welcome Email (after signup) ────────────────────────────────────────
export const sendWelcomeEmail = async (email: string, name: string) => {
  const safeName = escapeHtml(name);
  const dashboardLink = `${getBaseUrl()}/dashboard`;
  const html = emailWrapper(`
    <h2 style="margin:0 0 8px;color:#0f172a;font-size:24px;font-weight:800;">Welcome to WorkGrind, ${safeName}! 🎉</h2>
    <p style="margin:0 0 20px;color:#64748b;font-size:15px;line-height:1.7;">
      We're thrilled to have you on board. WorkGrind is your all-in-one team workspace — bringing together <strong>chat</strong>, <strong>project management</strong>, <strong>tasks</strong>, <strong>files</strong>, and <strong>meetings</strong> in one place so your team can move faster and stay aligned.
    </p>
    <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:12px;padding:20px 24px;margin:0 0 28px;">
      <p style="margin:0 0 12px;color:#0369a1;font-size:14px;font-weight:700;">🚀 Get started in 3 steps:</p>
      <ol style="margin:0;padding-left:20px;color:#475569;font-size:14px;line-height:2;">
        <li>Create or join your workspace</li>
        <li>Invite your team members</li>
        <li>Create your first project or start a conversation</li>
      </ol>
    </div>
    <div style="text-align:center;margin:32px 0;">
      <a href="${dashboardLink}" style="display:inline-block;background:#2563eb;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:12px;">
        Go to My Dashboard →
      </a>
    </div>
    <p style="margin:0;color:#94a3b8;font-size:13px;">
      Need help? Use the <a href="${getBaseUrl()}/contact" style="color:#3b82f6;">WorkGrind contact form</a>.
    </p>
  `);
  return safeSend(email, 'Welcome to WorkGrind 🎉', html);
};

// ─── 3. Password Reset Request ───────────────────────────────────────────────
export const sendPasswordResetEmail = async (email: string, name: string, rawToken: string) => {
  try {
    const safeName = escapeHtml(name);
    const link = `${getBaseUrl()}/reset-password/${encodeURIComponent(rawToken)}`;
    const html = emailWrapper(`
    <h2 style="margin:0 0 8px;color:#0f172a;font-size:24px;font-weight:800;">Reset your password 🔑</h2>
    <p style="margin:0 0 20px;color:#64748b;font-size:15px;">Hi <strong>${safeName}</strong>, we received a request to reset your WorkGrind account password.</p>
    <div style="text-align:center;margin:32px 0;">
      <a href="${link}" style="display:inline-block;background:#2563eb;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:12px;">
        Reset My Password
      </a>
    </div>
    <div style="background:#fefce8;border:1px solid #fde68a;border-radius:10px;padding:16px 20px;margin:0 0 20px;">
      <p style="margin:0;color:#92400e;font-size:13px;">⏰ This link expires in <strong>30 minutes</strong> and can only be used once.</p>
    </div>
    <p style="margin:0;color:#94a3b8;font-size:13px;">If you didn't request a password reset, you can safely ignore this email — your password won't change.</p>
    <p style="margin:12px 0 0;color:#94a3b8;font-size:13px;">
      Or copy and paste this URL into your browser:<br/>
      <span style="color:#3b82f6;word-break:break-all;">${link}</span>
    </p>
    `);
    return safeSend(email, 'Reset your WorkGrind password', html, undefined, 'password_reset');
  } catch (error) {
    logEmailError('password_reset', 'configuration', error);
    return { success: false, error: 'Email delivery failed.' };
  }
};

// ─── 4. Password Changed Notification ───────────────────────────────────────
export const sendPasswordChangedNotificationEmail = async (email: string, name: string) => {
  const safeName = escapeHtml(name);
  const time = new Date().toLocaleString('en-PK', { timeZone: 'Asia/Karachi', dateStyle: 'medium', timeStyle: 'short' });
  const html = emailWrapper(`
    <h2 style="margin:0 0 8px;color:#0f172a;font-size:24px;font-weight:800;">Password changed 🔒</h2>
    <p style="margin:0 0 20px;color:#64748b;font-size:15px;">Hi <strong>${safeName}</strong>, your WorkGrind account password was successfully updated on <strong>${time} (PKT)</strong>.</p>
    <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:16px 20px;margin:0 0 20px;">
      <p style="margin:0;color:#166534;font-size:13px;">✅ All existing sessions have been invalidated for your security.</p>
    </div>
    <div style="background:#fff1f2;border:1px solid #fecdd3;border-radius:10px;padding:16px 20px;margin:0 0 20px;">
      <p style="margin:0;color:#be123c;font-size:13px;font-weight:600;">🚨 If you did NOT perform this action, reset your password immediately:</p>
      <div style="text-align:center;margin-top:14px;">
        <a href="${getBaseUrl()}/forgot-password" style="display:inline-block;background:#e11d48;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:10px 28px;border-radius:10px;">
          Secure My Account
        </a>
      </div>
    </div>
    <p style="margin:0;color:#94a3b8;font-size:13px;">
      Questions? Use the <a href="${getBaseUrl()}/contact" style="color:#3b82f6;">WorkGrind contact form</a>.
    </p>
  `);
  return safeSend(email, 'Security Alert: Your WorkGrind password was changed', html);
};

// ─── 5. Team / Workspace Invite ──────────────────────────────────────────────
export const sendInviteEmail = async (email: string, inviterName: string, companyName: string, token: string) => {
  const link = `${getBaseUrl()}/join?token=${encodeURIComponent(token)}`;
  const html = emailWrapper(`
    <h2 style="margin:0 0 8px;color:#0f172a;font-size:24px;font-weight:800;">You're invited! 🎊</h2>
    <p style="margin:0 0 20px;color:#64748b;font-size:15px;">
      <strong>${inviterName}</strong> has invited you to join <strong>${companyName}</strong> on WorkGrind.
    </p>
    <div style="text-align:center;margin:32px 0;">
      <a href="${link}" style="display:inline-block;background:#2563eb;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:12px;">
        Accept Invitation →
      </a>
    </div>
    <p style="margin:0;color:#94a3b8;font-size:13px;">This invitation expires in <strong>7 days</strong>. If you weren't expecting this, you can safely ignore it.</p>
  `);
  return safeSend(email, `${inviterName} invited you to ${companyName} on WorkGrind`, html);
};

// ─── 5b. Client Portal Invite ────────────────────────────────────────────────
export const sendClientPortalInvite = async (email: string, clientName: string, acceptUrl: string) => {
  const html = emailWrapper(`
    <h2 style="margin:0 0 8px;color:#0f172a;font-size:24px;font-weight:800;">You've been invited to WorkGrind 🎉</h2>
    <p style="margin:0 0 20px;color:#64748b;font-size:15px;">
      Hi <strong>${clientName}</strong>, you've been invited to access a secure client portal.
      Click the button below to set up your account and view your shared projects, files, and updates.
    </p>
    <div style="text-align:center;margin:32px 0;">
      <a href="${acceptUrl}" style="display:inline-block;background:#4f46e5;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:12px;">
        Set Up My Account →
      </a>
    </div>
    <p style="margin:0;color:#94a3b8;font-size:13px;">This invitation link expires in <strong>7 days</strong>. If you weren't expecting this email, you can safely ignore it.</p>
  `);
  return safeSend(email, 'You have been invited to a WorkGrind client portal', html);
};

// ─── 6. Contact Us Inquiries ────────────────────────────────────────────────
export const sendContactInquiryEmail = async (inquiry: {
  name: string;
  email: string;
  company?: string;
  subject: string;
  message: string;
}) => {
  const supportEmail = process.env.SUPPORT_EMAIL?.trim() || process.env.EMAIL_USER?.trim() || '';
  if (!supportEmail) return { success: false, error: 'Support email destination is not configured.' };

  // 1. Send notification to WorkGrind Support
  const notificationHtml = emailWrapper(`
    <h2 style="margin:0 0 8px;color:#0f172a;font-size:22px;font-weight:800;">New Contact Us Inquiry 📬</h2>
    <p style="margin:0 0 20px;color:#64748b;font-size:14px;">A new inquiry has been submitted through the WorkGrind website contact form.</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;margin:0 0 24px;padding:16px 20px;">
      <tr>
        <td style="padding:6px 0;color:#64748b;font-size:13px;width:120px;font-weight:600;">From:</td>
        <td style="padding:6px 0;color:#0f172a;font-size:14px;font-weight:700;">${inquiry.name}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;color:#64748b;font-size:13px;font-weight:600;">Email:</td>
        <td style="padding:6px 0;color:#2563eb;font-size:14px;"><a href="mailto:${inquiry.email}" style="color:#2563eb;text-decoration:none;">${inquiry.email}</a></td>
      </tr>
      ${inquiry.company ? `
      <tr>
        <td style="padding:6px 0;color:#64748b;font-size:13px;font-weight:600;">Company:</td>
        <td style="padding:6px 0;color:#0f172a;font-size:14px;">${inquiry.company}</td>
      </tr>` : ''}
      <tr>
        <td style="padding:6px 0;color:#64748b;font-size:13px;font-weight:600;">Subject:</td>
        <td style="padding:6px 0;color:#0f172a;font-size:14px;font-weight:600;">${inquiry.subject}</td>
      </tr>
    </table>

    <div style="background:#ffffff;border-left:4px solid #3b82f6;padding:16px 20px;margin:0 0 24px;border-radius:4px;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
      <p style="margin:0 0 8px;color:#475569;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Inquiry Message:</p>
      <p style="margin:0;color:#1e293b;font-size:14px;line-height:1.7;white-space:pre-wrap;">${inquiry.message}</p>
    </div>

    <div style="text-align:center;margin:28px 0 0;">
      <a href="mailto:${inquiry.email}?subject=Re: [WorkGrind] ${encodeURIComponent(inquiry.subject)}" style="display:inline-block;background:#2563eb;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:12px 32px;border-radius:10px;">
        Reply to ${inquiry.name} →
      </a>
    </div>
  `);

  console.log(`[Email Service] Sending contact notification to support team (${supportEmail})...`);
  const supportResult = await safeSend(
    supportEmail,
    `[WorkGrind Contact] ${inquiry.subject} - from ${inquiry.name}`,
    notificationHtml,
    inquiry.email
  );

  // 2. Send automated acknowledgement to the inquirer
  const ackHtml = emailWrapper(`
    <h2 style="margin:0 0 8px;color:#0f172a;font-size:22px;font-weight:800;">Thank you for contacting WorkGrind! 🙌</h2>
    <p style="margin:0 0 20px;color:#64748b;font-size:15px;line-height:1.6;">
      Hi <strong>${inquiry.name}</strong>, we have received your message regarding <strong>${inquiry.subject}</strong>.
    </p>
    <p style="margin:0 0 24px;color:#64748b;font-size:14px;line-height:1.6;">
      Your inquiry has been recorded. Response time depends on availability.
    </p>

    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin:0 0 24px;">
      <p style="margin:0 0 8px;color:#475569;font-size:12px;font-weight:700;text-transform:uppercase;">Summary of your inquiry:</p>
      <p style="margin:0;color:#334155;font-size:13px;line-height:1.6;white-space:pre-wrap;">${inquiry.message}</p>
    </div>

    <p style="margin:0;color:#94a3b8;font-size:13px;">
      For further information, use the <a href="${getBaseUrl()}/contact" style="color:#3b82f6;text-decoration:none;">WorkGrind contact form</a>.
    </p>
  `);

  console.log(`[Email Service] Sending automated receipt confirmation to customer (${inquiry.email})...`);
  safeSend(inquiry.email, `We've received your inquiry: ${inquiry.subject} (WorkGrind)`, ackHtml).catch((e) =>
    console.error('[Email Service] Customer confirmation email failed:', e)
  );

  return supportResult;
};

// ─── Demo Request Email ────────────────────────────────────────────────────
export const sendDemoRequestEmail = async (demo: {
  name: string;
  email: string;
  company?: string;
  message?: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> => {
  const supportEmail = process.env.SUPPORT_EMAIL?.trim() || process.env.EMAIL_USER?.trim() || '';
  if (!supportEmail) return { success: false, error: 'Support email destination is not configured.' };

  // 1. Notification to support team
  const notificationHtml = emailWrapper(`
    <div style="margin-bottom:24px;">
      <span style="background:#eff6ff;color:#2563eb;font-size:12px;font-weight:700;padding:4px 10px;border-radius:20px;text-transform:uppercase;letter-spacing:0.5px;">
        Demo Request 🎯
      </span>
      <h2 style="margin:12px 0 6px;color:#0f172a;font-size:22px;font-weight:800;">
        New Demo Request Received
      </h2>
      <p style="margin:0;color:#64748b;font-size:14px;">
        A prospective customer has requested a live walkthrough of WorkGrind.
      </p>
    </div>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px 20px;margin-bottom:24px;">
      <tr>
        <td style="padding:6px 0;color:#64748b;font-size:13px;font-weight:600;width:120px;">Name:</td>
        <td style="padding:6px 0;color:#0f172a;font-size:14px;font-weight:700;">${demo.name}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;color:#64748b;font-size:13px;font-weight:600;">Work Email:</td>
        <td style="padding:6px 0;color:#2563eb;font-size:14px;font-weight:600;">
          <a href="mailto:${demo.email}" style="color:#2563eb;text-decoration:none;">${demo.email}</a>
        </td>
      </tr>
      ${demo.company ? `
      <tr>
        <td style="padding:6px 0;color:#64748b;font-size:13px;font-weight:600;">Company:</td>
        <td style="padding:6px 0;color:#0f172a;font-size:14px;font-weight:600;">${demo.company}</td>
      </tr>` : ''}
    </table>

    ${demo.message ? `
    <div style="background:#ffffff;border-left:4px solid #3b82f6;padding:16px 20px;margin:0 0 24px;border-radius:4px;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
      <p style="margin:0 0 8px;color:#475569;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Requirements / What they want to explore:</p>
      <p style="margin:0;color:#1e293b;font-size:14px;line-height:1.7;white-space:pre-wrap;">${demo.message}</p>
    </div>` : ''}

    <div style="text-align:center;margin:28px 0 0;">
      <a href="mailto:${demo.email}?subject=Re: [WorkGrind Demo] Scheduling your live walkthrough" style="display:inline-block;background:#2563eb;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:12px 32px;border-radius:10px;">
        Reply to ${demo.name} →
      </a>
    </div>
  `);

  console.log(`[Email Service] Sending demo request notification to support team (${supportEmail})...`);
  const supportResult = await safeSend(
    supportEmail,
    `[WorkGrind Demo] Walkthrough Request - ${demo.name}${demo.company ? ` (${demo.company})` : ''}`,
    notificationHtml,
    demo.email
  );

  // 2. Automated acknowledgment to prospect
  const ackHtml = emailWrapper(`
    <h2 style="margin:0 0 8px;color:#0f172a;font-size:22px;font-weight:800;">Thanks for requesting a WorkGrind demo! 🚀</h2>
    <p style="margin:0 0 20px;color:#64748b;font-size:15px;line-height:1.6;">
      Hi <strong>${demo.name}</strong>, thank you for your interest in WorkGrind. We have received your demo request.
    </p>
    <p style="margin:0 0 24px;color:#64748b;font-size:14px;line-height:1.6;">
      One of our workspace solution specialists will reach out to you shortly to coordinate a convenient time for your personalized 1-on-1 walkthrough.
    </p>

    ${demo.message ? `
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin:0 0 24px;">
      <p style="margin:0 0 8px;color:#475569;font-size:12px;font-weight:700;text-transform:uppercase;">Your Notes / Requirements:</p>
      <p style="margin:0;color:#334155;font-size:13px;line-height:1.6;white-space:pre-wrap;">${demo.message}</p>
    </div>` : ''}

    <p style="margin:0;color:#94a3b8;font-size:13px;">
      Need assistance? Use the <a href="${getBaseUrl()}/contact" style="color:#3b82f6;text-decoration:none;">WorkGrind contact form</a>.
    </p>
  `);

  console.log(`[Email Service] Sending automated receipt confirmation to demo requester (${demo.email})...`);
  safeSend(demo.email, `We've received your WorkGrind Demo request!`, ackHtml).catch((e) =>
    console.error('[Email Service] Demo confirmation email failed:', e)
  );

  return supportResult;
};

// ─── Admin Reply Email to User ─────────────────────────────────────────────
export const sendAdminReplyEmail = async (params: {
  to: string;
  recipientName: string;
  replyText: string;
  originalSubject: string;
  originalMessage: string;
  adminName?: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> => {
  const safeRecipientName = escapeHtml(params.recipientName);
  const replySubject = params.originalSubject.toLowerCase().startsWith('re:')
    ? params.originalSubject
    : `Re: ${params.originalSubject} - WorkGrind Support`;

  const html = emailWrapper(`
    <div style="margin-bottom:20px;">
      <h2 style="margin:0 0 8px;color:#0f172a;font-size:22px;font-weight:800;">
        Response from WorkGrind Support
      </h2>
      <p style="margin:0;color:#64748b;font-size:14px;">
        Hi <strong>${safeRecipientName}</strong>, our team has reviewed your inquiry.
      </p>
    </div>

    <!-- Admin Reply Content -->
    <div style="background:#ffffff;border:1px solid #e2e8f0;border-left:4px solid #2563eb;border-radius:8px;padding:20px;margin-bottom:24px;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
      <p style="margin:0;color:#0f172a;font-size:15px;line-height:1.7;white-space:pre-wrap;">${params.replyText}</p>
    </div>

    <p style="margin:0 0 24px;color:#64748b;font-size:13px;">
      Best regards,<br/>
      <strong style="color:#1e293b;">${params.adminName || 'WorkGrind Support Team'}</strong>
    </p>

    <!-- Original Message Quoted -->
    <div style="border-top:1px dashed #cbd5e1;padding-top:20px;margin-top:24px;">
      <p style="margin:0 0 8px;color:#94a3b8;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">
        Original Inquiry (${params.originalSubject}):
      </p>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 16px;color:#64748b;font-size:13px;line-height:1.6;white-space:pre-wrap;">
        ${params.originalMessage}
      </div>
    </div>
  `);

  console.log(`[Email Service] Dispatching admin reply to ${params.to}...`);
  return safeSend(params.to, replySubject, html, getFromAddress());
};

// ─── Safe SMTP Verification Mechanism ────────────────────────────────────────
export const verifySMTPConnection = async (testRecipient?: string): Promise<{ success: boolean; message: string }> => {
  try {
    const t = await getTransporter();
    await t.verify();
    if (testRecipient) {
      await t.sendMail({
        from: getFromAddress(),
        to: testRecipient,
        subject: 'WorkGrind SMTP Test',
        text: 'SMTP configuration is valid and verified.',
        html: emailWrapper(`
          <h2 style="margin:0 0 8px;color:#0f172a;font-size:20px;font-weight:700;">SMTP Verification Successful ✅</h2>
          <p style="margin:0;color:#475569;font-size:14px;">Your WorkGrind Gmail SMTP configuration is valid and working.</p>
        `),
      });
    }
    return { success: true, message: 'Email sent successfully' };
  } catch (err: any) {
    return { success: false, message: 'SMTP connection or authentication failed' };
  }
};
