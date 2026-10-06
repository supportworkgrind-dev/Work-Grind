import type { LegalDocument } from '@/components/legal/LegalDocumentPage';

export const LEGAL_UPDATED_DATE = 'October 5, 2026';

export const legalDocuments: Record<string, LegalDocument> = {
  privacy: {
    title: 'Privacy Policy',
    summary: 'This policy describes the information WorkGrind processes to provide its workspace, communication, file, support, and billing features.',
    updated: LEGAL_UPDATED_DATE,
    sections: [
      { title: 'Information processed', paragraphs: ['Account information includes the name, email address, password credential, verification state, and profile details you provide. Workspace information includes members, tasks, projects, calendar entries, CRM records, messages, calls and meeting metadata, client portal records, and files you or your workspace members submit.', 'Billing records include the selected plan, subscription state, dates, and payment-provider identifiers received from Polar. WorkGrind does not need your full payment-card number to maintain a subscription record. Contact form submissions include the details and message you submit.'] },
      { title: 'Browser storage', paragraphs: ['The application stores authentication tokens in session storage for the active browser session. Depending on the feature, it also stores preferences and drafts in local storage, including language, theme, chat sound, PWA prompt state, task views, and locally saved work. A first-party theme preference is also stored in a SameSite=Lax cookie for up to one year so the selected theme can be applied on the next request. See Cookie Preferences for details.'] },
      { title: 'How information is used', paragraphs: ['Information is used to authenticate accounts, provide workspace features, route messages and calls, store and retrieve files, maintain subscription state, support users who submit inquiries, protect the service, and operate the features a user requests. AI features process the prompts and related context needed to produce a response when those features are used.'] },
      { title: 'Service providers and sharing', paragraphs: ['WorkGrind uses configured infrastructure and service providers to operate the product. The project integrates MongoDB for application records, Cloudflare R2 when configured for file storage, Polar for subscription checkout and subscription events, configured email delivery, and configured AI providers when an AI feature is used. These providers receive data only as needed for the requested product function. Workspace administrators and collaborators may also see content shared within their workspace or client portal.'] },
      { title: 'Retention and requests', paragraphs: ['The application does not publish a universal retention period for every record. Some workspace content is retained as needed to provide the service and may remain available to workspace members after a plan changes. To ask about access, correction, or deletion of account or workspace data, submit a request through the contact form. The request may need to be handled by the workspace owner for workspace-managed content.'] },
      { title: 'Security and legal details', paragraphs: ['WorkGrind uses application authentication and authorization controls described in its Security Policy. This policy does not claim a security certification or a particular legal compliance status. The contracting legal entity, applicable jurisdiction, and any country-specific privacy terms have not been specified in the project and must be supplied in the applicable customer agreement.'] },
    ],
  },
  terms: {
    title: 'Terms of Service',
    summary: 'These terms cover access to WorkGrind, an online business workspace with collaboration, work management, file, client portal, AI, and billing features.',
    updated: LEGAL_UPDATED_DATE,
    sections: [
      { title: 'Accounts and workspaces', paragraphs: ['Provide accurate account information, keep your sign-in credentials confidential, and promptly report suspected unauthorized access using the contact form. Workspace owners and administrators manage membership, roles, and shared content for their workspace. You are responsible for ensuring you have the rights needed to submit content to WorkGrind.'] },
      { title: 'Use of the service', paragraphs: ['Use WorkGrind only for lawful purposes and in accordance with the Acceptable Use Policy and Community Guidelines. Do not attempt to access another account or workspace without authorization, bypass access controls, disrupt the service, or upload malicious content.'] },
      { title: 'Plans and billing', paragraphs: ['The available plans and configured storage limits are shown on the pricing and billing pages. New accounts may receive a seven-day trial as described in the product. Paid checkout and subscription state are handled through Polar. Cancellation, plan changes, and refund information are described in the relevant policies and are subject to the checkout terms presented for the transaction.'] },
      { title: 'Content and service operation', paragraphs: ['You retain responsibility for the content you and your workspace members submit. WorkGrind processes that content to deliver the features you use. Do not use AI-generated content without appropriate review for your intended purpose. The service depends on internet access, configured providers, and ongoing maintenance; no uptime commitment or service-level agreement is stated here.'] },
      { title: 'Changes and legal details', paragraphs: ['WorkGrind may update the service or these terms. Material changes will be reflected by updating the date on this page. The project does not identify the contracting legal entity or governing-law jurisdiction; these details must be completed in a customer-specific agreement where required. Nothing on this page invents or substitutes for those details.'] },
    ],
  },
  cookies: {
    title: 'Cookie Preferences',
    summary: 'WorkGrind uses browser storage for authentication and product preferences. The project does not implement an advertising-cookie consent manager.',
    updated: LEGAL_UPDATED_DATE,
    sections: [
      { title: 'Cookies used by the app', paragraphs: ['A first-party cookie named workgrind_theme stores the selected visual theme for up to one year. It uses Path=/ and SameSite=Lax, and is marked Secure when the app is served over HTTPS. It is a preference cookie, not an authentication cookie.'] },
      { title: 'Other browser storage', paragraphs: ['Authentication tokens use sessionStorage. The app also uses localStorage for preferences and feature state such as language, theme, muted chat sounds, dismissed install prompts, task views, and some drafts. Client portal and administrative sessions have separate browser storage keys. These browser storage entries are not cookies.'] },
      { title: 'Manage the saved theme', paragraphs: ['Use the control below to reset the theme to the WorkGrind default. When signed in, the default is saved to your account; when signed out, the browser preference is cleared. You can also clear site data through your browser. Clearing authentication storage signs you out.'] },
    ],
  },
  refunds: {
    title: 'Refund Policy',
    summary: 'This page explains what the current WorkGrind application does and does not provide for refunds.',
    updated: LEGAL_UPDATED_DATE,
    sections: [
      { title: 'Current refund process', paragraphs: ['The WorkGrind application does not provide a self-service refund action or an in-app refund eligibility workflow. A refund is not automatically issued when a subscription is cancelled. Refund eligibility, if any, is governed by the terms shown during checkout, the payment provider’s applicable process, and applicable law; this page does not promise a refund or a response timeframe.'] },
      { title: 'Billing questions', paragraphs: ['If a charge appears incorrect, use the WorkGrind contact form and select Technical Support. Include the relevant account email, transaction date, and a short description; do not submit full card details.'] },
    ],
  },
  cancellation: {
    title: 'Cancellation Policy',
    summary: 'Subscription cancellation is managed by the authenticated workspace billing flow and Polar.',
    updated: LEGAL_UPDATED_DATE,
    sections: [
      { title: 'Who can cancel', paragraphs: ['The workspace owner or an administrator can cancel an active company subscription from Billing. The backend requests cancellation through Polar and records that cancellation is scheduled for the end of the current billing period.'] },
      { title: 'Access after cancellation', paragraphs: ['The subscription remains effective through its current paid period. Where available, an owner or administrator can reactivate it before cancellation takes effect. When the paid period ends, the workspace resolves to the free plan and its 1 GB storage limit. Existing files are not automatically deleted, but new uploads remain subject to the current storage quota.'] },
      { title: 'Refunds', paragraphs: ['Cancellation does not itself issue a refund. See the Refund Policy and the checkout terms applicable to your transaction.'] },
    ],
  },
  disclaimer: {
    title: 'Disclaimer',
    summary: 'Important information about WorkGrind and content generated or shared through the service.',
    updated: LEGAL_UPDATED_DATE,
    sections: [
      { title: 'Service information', paragraphs: ['WorkGrind is provided as an online software service. Product descriptions are informational and do not create an uptime commitment, service-level agreement, or guarantee that every feature will be available in every deployment.'] },
      { title: 'User and AI content', paragraphs: ['Users and workspace administrators are responsible for reviewing content they submit, share, or rely on. AI outputs may be incomplete or inaccurate and should be independently checked before use. WorkGrind does not provide legal, medical, financial, or other professional advice through AI features.'] },
      { title: 'External services', paragraphs: ['Some features depend on providers configured for the deployment, including payment, storage, email, and AI services. Their availability and terms may affect the related WorkGrind features.'] },
    ],
  },
  accessibility: {
    title: 'Accessibility Statement',
    summary: 'WorkGrind aims to make its web application usable by people with different access needs.',
    updated: LEGAL_UPDATED_DATE,
    sections: [
      { title: 'Current status', paragraphs: ['A formal accessibility conformance audit has not been verified for this project. WorkGrind therefore does not claim WCAG conformance or certification. Some interface areas may have barriers, and accessibility can vary by page, browser, and assistive technology.'] },
      { title: 'Report an accessibility barrier', paragraphs: ['Use the contact form and select Technical Support. Tell us which page and task you were trying to complete, the browser and assistive technology involved if you wish, and what prevented completion. Do not include sensitive personal or workspace data.'] },
    ],
  },
  dpa: {
    title: 'Data Processing Agreement',
    summary: 'This is a proposed template for business customers. It is not automatically incorporated into every WorkGrind customer relationship and is not effective unless separately agreed by the relevant parties.',
    updated: LEGAL_UPDATED_DATE,
    sections: [
      { title: 'Parties and scope', paragraphs: ['Customer legal name: [Customer legal name]. Service provider legal name: [WorkGrind contracting entity — to be completed]. This template applies only when completed and signed or otherwise expressly accepted by both parties. It covers personal data processed by the provider on the customer’s documented instructions through the WorkGrind service.'] },
      { title: 'Roles and processing', paragraphs: ['For customer workspace content, the customer determines the purposes and means of processing and the provider processes that content to supply the service. The provider may separately process account, security, support, and billing administration data for operating the service. Processing details, duration, data-subject categories, and data categories must be completed by the parties for the relevant deployment.'] },
      { title: 'Instructions and confidentiality', paragraphs: ['The provider will process covered data only to deliver, secure, support, and maintain the service and as otherwise documented by the customer or required by law. Personnel authorized to handle the data must be subject to appropriate confidentiality obligations.'] },
      { title: 'Security and subprocessors', paragraphs: ['The provider will maintain technical and organizational measures appropriate to the service and described in the Security Policy. Providers used for hosting, file storage, subscription processing, email, and AI may process data when those features are configured or used. The customer-specific subprocessor list, locations, notice process, and objection mechanism must be completed in the executed agreement; this template does not represent that a definitive list or transfer mechanism has already been agreed.'] },
      { title: 'Assistance, incidents, and deletion', paragraphs: ['The parties should document assistance for data-subject requests, security incidents, impact assessments, and regulatory inquiries, together with notification contacts and timeframes. At termination, data return or deletion, backup handling, and any legal-retention exceptions must be agreed for the applicable deployment. No unverified response deadline or deletion schedule is created by this template.'] },
      { title: 'Execution fields', paragraphs: ['Customer: [name, address, signatory, date]. Provider: [legal entity, address, signatory, date]. Governing law, international-transfer terms, audit rights, and any jurisdiction-specific clauses remain for the parties to complete and agree.'] },
    ],
  },
  'acceptable-use': {
    title: 'Acceptable Use Policy',
    summary: 'This policy applies to accounts, workspaces, content, files, messaging, calling, AI, and other WorkGrind features.',
    updated: LEGAL_UPDATED_DATE,
    sections: [
      { title: 'Prohibited use', paragraphs: ['Do not use WorkGrind to violate law or others’ rights, threaten or harass people, distribute malware, send spam, facilitate fraud, or store or share content you are not authorized to use. Do not probe, disrupt, overload, scrape, reverse engineer, or bypass access controls except where applicable law permits.'] },
      { title: 'Respect access and workspace boundaries', paragraphs: ['Access only accounts, workspaces, files, meetings, client portals, and messages for which you have permission. Do not evade blocks, privacy settings, workspace roles, rate limits, or subscription limits. Do not impersonate another person or misrepresent your identity.'] },
      { title: 'Enforcement', paragraphs: ['Workspace administrators may manage membership and content within their workspace. WorkGrind may investigate reports and restrict access where reasonably necessary to protect users, the service, or legal rights. Use the contact form to report abuse or suspected compromise.'] },
    ],
  },
  security: {
    title: 'Security Policy',
    summary: 'A summary of security controls implemented in the WorkGrind application; this is not a certification or independent audit report.',
    updated: LEGAL_UPDATED_DATE,
    sections: [
      { title: 'Implemented application controls', paragraphs: ['The backend uses authenticated API access, role checks for privileged workspace and billing actions, workspace-scoped data access, password verification and reset flows, expiring email verification codes, and rate limiting on selected authentication endpoints. Multi-factor authentication support is implemented for accounts that enable it. Polar webhook updates use signature verification, and selected administrative or billing actions create audit records.'] },
      { title: 'Deployment-dependent controls', paragraphs: ['Transport security, database and object-storage configuration, backups, provider access, monitoring, and incident operations depend in part on the deployment and configured infrastructure. This project does not establish a universal encryption-at-rest claim, uptime guarantee, third-party audit, or compliance certification.'] },
      { title: 'Account safety', paragraphs: ['Use a unique password, keep devices and verification email secure, and promptly report suspicious access through the contact form. Workspace owners should review membership and access permissions.'] },
    ],
  },
  'responsible-disclosure': {
    title: 'Responsible Disclosure',
    summary: 'WorkGrind welcomes reports that help identify security issues in the application.',
    updated: LEGAL_UPDATED_DATE,
    sections: [
      { title: 'How to report', paragraphs: ['Submit a report using the WorkGrind contact form and select Technical Support. Include the affected page or endpoint, clear reproduction steps, the potential impact, and a way to follow up. Do not include real user data, credentials, access tokens, or secrets.'] },
      { title: 'Testing boundaries', paragraphs: ['Test only accounts and systems you own or are explicitly authorized to assess. Do not access, modify, or delete another user’s data; disrupt service; conduct social engineering; or perform destructive testing. Stop testing once you have established the issue.'] },
      { title: 'Coordination', paragraphs: ['The project does not publish a bounty, guaranteed response time, or safe-harbor commitment. Please allow time for triage and remediation before public disclosure, and avoid sharing details that could put users at risk.'] },
    ],
  },
  'community-guidelines': {
    title: 'Community Guidelines',
    summary: 'These guidelines apply to WorkGrind collaboration features, including channels, direct messages, meetings, calls, and client portals.',
    updated: LEGAL_UPDATED_DATE,
    sections: [
      { title: 'Treat people respectfully', paragraphs: ['Communicate professionally. Do not harass, threaten, discriminate against, impersonate, or repeatedly contact people who have asked you to stop. Respect blocks, privacy settings, workspace boundaries, and meeting participation choices.'] },
      { title: 'Share responsibly', paragraphs: ['Post in relevant channels, avoid unsolicited bulk messages, and share files and client information only with people authorized to receive them. Do not distribute unlawful, infringing, deceptive, or malicious content.'] },
      { title: 'Reporting and moderation', paragraphs: ['Workspace owners and administrators manage local membership and permissions. Report abusive or unsafe use through the contact form. WorkGrind may review reports and take proportionate action under the Terms of Service and Acceptable Use Policy.'] },
    ],
  },
};
