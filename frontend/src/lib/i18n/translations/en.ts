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
    tagline:  'One intelligent workspace for modern teams.',
    company:  'Company',
    security: 'Security',
    about:    'About',
    features: 'Features',
    demo:     'Demo',
    contact:  'Contact',
    privacy:  'Privacy Policy',
    terms:    'Terms of Service',
    rights:   '© {{year}} WorkGrind. All rights reserved.',
    trial:    '7-day free trial · No long-term commitment · Built for modern teams',
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
    badge:       'Our Mission',
    headline1:   'Reimagining how modern',
    headline2:   'organizations',
    headline3:   'work together',
    subheadline: 'WorkGrind was created with a single core mandate: eliminate software fragmentation and restore deep focus for teams worldwide.',
    stats: {
      workspaces: 'Workspaces Created',
      messages:   'Messages Delivered',
      tasks:      'Tasks Completed',
      uptime:     'Uptime SLA',
    },
    story: {
      heading: 'The Story Behind WorkGrind',
      p1: "In today's digital office, employees spend up to 30% of their workday toggling between half a dozen disconnected tools — messaging apps, task boards, video meeting clients, cloud drives, and standalone document editors.",
      p2: 'This constant context switching leads to fragmented communication, missed project deadlines, and employee burnout. WorkGrind solves this by bringing every essential workplace tool into one cohesive, high-performance web platform.',
    },
    pillars: {
      sync:     { title: 'Instant Real-Time Sync',    desc: 'Powered by Socket.io and real-time MongoDB queries for zero latency across chat, tasks, and presence.' },
      security: { title: 'Enterprise Security',        desc: 'Row-level multi-tenant isolation, encrypted sessions, bcrypt passwords, and strict RBAC controls.' },
      scale:    { title: 'Global Scale',               desc: 'Architected to support hybrid, remote, and multi-office distributed workforces from day one.' },
    },
    workspace: {
      heading:    'Everything in one workspace',
      subheading: '12 deeply integrated modules replacing 12 separate SaaS subscriptions.',
    },
    cta: {
      badge:    'Executive Leadership',
      name:     'RANA MOEZ',
      role:     'Product Architect & Lead Systems Engineer',
      button:   'Start for free',
    },
  },

  // ── Features page ─────────────────────────────────────────────────────────
  features: {
    badge:       'Complete Feature Set',
    headline:    'Every tool your team needs to thrive',
    subheadline: 'Discover how WorkGrind replaces disconnected apps with one connected workspace platform.',
    cta: {
      heading: 'Ready to test these features live?',
      sub:     'Create your company workspace in under 30 seconds with zero credit card commitment.',
    },
    items: {
      chat:          { title: 'Real-Time Communication',        tag: 'Chat & DMs',      desc: 'Organize team discussions into public channels by project or department, run private team channels, send direct messages, write rich Markdown, and react with custom emojis.' },
      tasks:         { title: 'Task & Work Management',         tag: 'Kanban & Lists',  desc: 'Track deliverables through flexible Kanban boards or structured lists. Assign owners, set due dates, break tasks into subtasks, and set priority badges.' },
      projects:      { title: 'Project Roadmaps & Progress',    tag: 'Management',      desc: 'Group tasks into company projects. Monitor real-time completion progress bars, track project managers, link dedicated channels, and deliver sprints on schedule.' },
      files:         { title: 'Cloud Document & File Drive',    tag: 'Workplace Drive', desc: 'Store all corporate files in a folder tree. Create Notion-style collaborative docs with version history, rich formatting, and instant team sharing.' },
      meetings:      { title: 'Video Meetings & Calendar',      tag: 'Video & Events',  desc: 'Host WebRTC video calls with screen sharing, mic/camera controls, and participant lists. Schedule synchronized team meetings directly on the calendar.' },
      ai:            { title: 'AI Workspace Copilot',           tag: 'AI Assistance',   desc: 'Utilize built-in AI to summarize meeting transcripts into actionable bullet points, draft project briefs, and generate task lists in seconds.' },
      search:        { title: '⌘K Global Unified Search',       tag: 'Instant Search',  desc: 'Find any team member, task, message, channel, document, or uploaded file across your company instance instantly using single-keystroke global search.' },
      notifications: { title: 'Centralized Notifications',      tag: 'Alerts',          desc: 'Stay informed without notification overload. Get immediate alerts when mentioned in channels, assigned a task, or invited to an upcoming video meeting.' },
    },
  },

  // ── Demo page ─────────────────────────────────────────────────────────────
  demo: {
    badge:       'Personalized Walkthrough',
    headline:    'Book a WorkGrind Demo',
    subheadline: "Tell us about your team and we'll schedule a quick, personalized 1-on-1 walkthrough tailored to your workflow.",
    form: {
      name:        'Full Name',
      email:       'Work Email',
      company:     'Company Name',
      message:     'What would you like to explore?',
      namePH:      'e.g. Alex Rivera',
      emailPH:     'alex@company.com',
      companyPH:   'Acme Corp',
      messagePH:   "Tell us what you'd like to see — team chat, project kanban, AI summaries, permissions...",
      submit:      'Request Live Demo',
      submitting:  'Submitting…',
    },
    success: {
      heading: "Thanks! We'll reach out soon.",
      sub:     'We received your demo request for {{email}}. Our solutions team will email you shortly.',
      home:    'Return to Home',
      another: 'Submit Another Request',
    },
  },

  // ── Contact page ──────────────────────────────────────────────────────────
  contact: {
    badge:   'Get In Touch',
    headline: 'Contact WorkGrind',
    sub:      'Have questions about deployment, custom enterprise plans, or platform migration? Our product team is here to help.',
    form: {
      heading:    'Send us a message',
      name:       'Your Name',
      email:      'Work Email',
      company:    'Company',
      subject:    'Subject',
      message:    'Message',
      namePH:     'Sarah Jenkins',
      emailPH:    'sarah@company.com',
      companyPH:  'Apex Technologies',
      messagePH:  'Tell us about your team size, workflow requirements, or questions…',
      submit:     'Send Inquiry',
      submitting: 'Sending…',
      subjects: {
        sales:   'Sales & Enterprise Demo',
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
