/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Defines the shape that every translation file must satisfy.
 * Values are typed as `string` so other languages can provide their own text.
 */
export interface TranslationShape {
  dir:  'ltr' | 'rtl';
  nav:  { [k: string]: string };
  footer: { [k: string]: string };
  common: { [k: string]: string };
  about: {
    badge: string; headline1: string; headline2: string; headline3: string;
    subheadline: string;
    stats:    { [k: string]: string };
    story:    { heading: string; p1: string; p2: string };
    pillars:  { [k: string]: { title: string; desc: string } };
    workspace:{ heading: string; subheading: string };
    cta:      { badge: string; name: string; role: string; button: string };
  };
  features: {
    badge: string; headline: string; subheadline: string;
    cta:   { heading: string; sub: string };
    items: { [k: string]: { title: string; tag: string; desc: string } };
  };
  demo: {
    badge: string; headline: string; subheadline: string;
    form:    { [k: string]: string };
    success: { [k: string]: string };
  };
  contact: {
    badge: string; headline: string; sub: string;
    form: { [k: string]: string | { [k: string]: string } };
    success: { [k: string]: string };
  };
}

// Re-export alias used by translation files
export type Translations = TranslationShape;

export const en: TranslationShape = {
  // ── Meta ──────────────────────────────────────────────────────────────────
  dir: 'ltr',

  // ── Shared Nav ────────────────────────────────────────────────────────────
  nav: {
    signIn:     'Sign In',
    getStarted: 'Get Started',
    openWorkspace: 'Open Workspace',
    product:    'Product',
    solutions:  'Solutions',
    features:   'Features',
    ai:         'AI',
    security:   'Security',
    backToHome: '← Back to Home',
  },

  // ── Shared Footer ─────────────────────────────────────────────────────────
  footer: {
    tagline:  'A connected workspace for personal work, business, and education.',
    company:  'Company',
    security: 'Security',
    about:    'About',
    features: 'Features',
    demo:     'Demo',
    contact:  'Contact',
    privacy:  'Privacy Policy',
    terms:    'Terms of Service',
    rights:   '© {{year}} WorkGrind. All rights reserved.',
    trial:    'Choose a Solo, Company, School, College, or University workspace.',
  },

  // ── Common ────────────────────────────────────────────────────────────────
  common: {
    submit:         'Submit',
    send:           'Send',
    cancel:         'Cancel',
    loading:        'Loading…',
    optional:       'optional',
    required:       'required',
    errorGeneric:   'Something went wrong. Please try again.',
    backToHome:     'Back to Home',
    startFreeTrial: 'Start Free Trial',
    learnMore:      'Learn More',
    close:          'Close',
  },

  // ── About page ────────────────────────────────────────────────────────────
  about: {
    badge:       'About WorkGrind',
    headline1:   'One connected workspace for',
    headline2:   'work and learning',
    headline3:   '',
    subheadline: 'WorkGrind brings personal productivity, business collaboration, and academic administration into workspace experiences designed for each audience.',
    stats: {
      workspaces: 'Solo',
      messages:   'Company',
      tasks:      'School / Academy',
      uptime:     'College / University',
    },
    story: {
      heading: 'A workspace shaped around how you work',
      p1: 'A person organizing their day, a company coordinating customers and projects, and an educational institution managing classes all need different tools and permissions.',
      p2: 'WorkGrind offers separate Solo, Company, School / Academy, College, and University workspaces. Shared capabilities such as communication and files sit alongside features intended for a particular workspace type.',
    },
    pillars: {
      sync:     { title: 'Connected work', desc: 'Keep supported tasks, projects, schedules, conversations, and shared records in one workspace.' },
      security: { title: 'Workspace permissions', desc: 'Access depends on workspace membership, role, feature availability, and the data being requested.' },
      scale:    { title: 'Different ways to work', desc: 'Choose a personal, business, school, college, or university workspace at account setup.' },
    },
    workspace: {
      heading:    'Choose the workspace that fits',
      subheading: 'Business CRM and client tools are separate from academic administration; personal work stays personal.',
    },
    cta: {
      badge:    'Explore WorkGrind',
      name:     'Find your workspace',
      role:     'Compare the five workspace types and choose the one that fits.',
      button:   'Get Started',
    },
  },

  // ── Features page ─────────────────────────────────────────────────────────
  features: {
    badge:       'Workspaces and capabilities',
    headline:    'The right tools for the work in front of you',
    subheadline: 'WorkGrind separates personal productivity, business operations, and education administration while keeping useful collaboration capabilities connected.',
    cta: {
      heading: 'Choose how you want to use WorkGrind',
      sub:     'Select Solo, Company, School / Academy, College, or University during signup.',
    },
    items: {
      chat:          { title: 'Workspace communication', tag: 'Chat & messages', desc: 'Use eligible workspace channels and direct messages to keep conversations connected to shared work.' },
      tasks:         { title: 'Tasks and planning', tag: 'Personal or team work', desc: 'Create and organize tasks, set priorities and due dates, and track progress in workspaces where task tools are available.' },
      projects:      { title: 'Projects', tag: 'Company and Solo', desc: 'Group related work, coordinate project members, and follow progress and deadlines in eligible workspaces.' },
      files:         { title: 'Files and documents', tag: 'Shared capability', desc: 'Organize files and documents with workspace and role-based access. Availability depends on account type and plan.' },
      meetings:      { title: 'Meetings and calendar', tag: 'Shared capability', desc: 'Schedule meetings and review calendar items when enabled for the workspace and subscription.' },
      ai:            { title: 'Tavro AI', tag: 'AI assistance', desc: 'Get help with supported work and learning questions using available workspace information; actions depend on your role and plan.' },
      search:        { title: 'Workspace search', tag: 'Find information', desc: 'Search supported people, tasks, messages, documents, and files within your authorized workspace.' },
      notifications: { title: 'Notifications', tag: 'Updates', desc: 'Review updates and alerts for activity available to your account.' },
    },
  },

  // ── Demo page ─────────────────────────────────────────────────────────────
  demo: {
    badge:       'Personalized Walkthrough',
    headline:    'Request a WorkGrind Walkthrough',
    subheadline: "Tell us whether you’re exploring Solo, Company, School / Academy, College, or University use, and what you’d like to understand.",
    form: {
      name:        'Full Name',
      email:       'Email Address',
      company:     'Company or institution (optional)',
      message:     'What would you like to explore?',
      namePH:      'e.g. Alex Rivera',
      emailPH:     'alex@company.com',
      companyPH:   'Organization name',
      messagePH:   "Share the workspace type and capabilities you want to explore.",
      submit:      'Request a Walkthrough',
      submitting:  'Submitting…',
    },
    success: {
      heading: "Thanks! We'll reach out soon.",
      sub:     'We received your walkthrough request for {{email}}. The WorkGrind team will follow up using the contact details you provided.',
      home:    'Return to Home',
      another: 'Submit Another Request',
    },
  },

  // ── Contact page ──────────────────────────────────────────────────────────
  contact: {
    badge:   'Get In Touch',
    headline: 'Contact WorkGrind',
    sub:      'Questions about a Solo, Company, School / Academy, College, or University workspace, plans, or support? Send us a message.',
    form: {
      heading:    'Send us a message',
      name:       'Your Name',
      email:      'Email Address',
      company:    'Company or institution (optional)',
      subject:    'Subject',
      message:    'Message',
      namePH:     'Sarah Jenkins',
      emailPH:    'you@example.com',
      companyPH:  'Organization name',
      messagePH:  'Tell us which workspace type you’re asking about and how we can help…',
      submit:     'Send Inquiry',
      submitting: 'Sending…',
      subjects: {
        sales:   'Plans and product questions',
        support: 'Technical Support',
        partner: 'Partnership Opportunities',
        general: 'General Question',
      },
    },
    success: {
      heading: 'Message Received!',
      sub:     'Your message was recorded.',
      another: 'Send Another Message',
    },
  },

};
