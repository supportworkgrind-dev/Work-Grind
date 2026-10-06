import type { Metadata } from 'next';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import {
  Activity, ArrowDown, ArrowRight, ArrowUpDown, BarChart3, Bell, Blocks, BookOpen,
  BriefcaseBusiness, CalendarDays, CheckSquare, CircleHelp, ClipboardList, Code2, FolderOpen,
  GitBranch, Globe2, Handshake, LayoutDashboard, ListChecks, MessageSquare, PanelsTopLeft, Phone,
  ShieldCheck, Sparkles, Users, Workflow,
} from 'lucide-react';
import { PublicFooter } from '@/components/landing/PublicFooter';
import { PublicNavbar } from '@/components/landing/PublicNavbar';
import { RevealOnScroll } from '@/components/landing/RevealOnScroll';

export const metadata: Metadata = {
  title: 'How WorkGrind Works | One Workspace for Your Business',
  description: 'See how WorkGrind connects daily work, CRM, the Client Portal, global calling, and scoped API access for external apps.',
  openGraph: {
    title: 'How WorkGrind Works | One Workspace for Your Business',
    description: 'Explore how WorkGrind connects company work, CRM, client access, global calling, and external applications.',
    url: '/how-it-works',
    siteName: 'WorkGrind',
    type: 'website',
    images: [{ url: '/workgrind-icon.svg', width: 512, height: 512, alt: 'WorkGrind logo' }],
  },
  twitter: {
    card: 'summary',
    title: 'How WorkGrind Works | One Workspace for Your Business',
    description: 'See how WorkGrind connects work, customers, communication, phone activity, and external apps.',
    images: ['/workgrind-icon.svg'],
  },
};

const flow = [
  { label: 'Plan', description: 'Set priorities in Daily Focus and see the work ahead.', href: '#workspace', color: '#57c7a5', icon: ListChecks },
  { label: 'Organize', description: 'Shape tasks, owners, deadlines, and projects.', href: '#workspace', color: '#6f86e8', icon: PanelsTopLeft },
  { label: 'Collaborate', description: 'Bring conversations, meetings, and shared knowledge together.', href: '#collaboration', color: '#48a9d8', icon: MessageSquare },
  { label: 'Manage Customers', description: 'Keep contacts, deals, and client-facing work connected.', href: '#customers', color: '#e5a64d', icon: Handshake },
  { label: 'Automate', description: 'Turn supported triggers into repeatable team actions.', href: '#resources', color: '#5bb7a4', icon: Workflow },
  { label: 'Analyze', description: 'Review activity and performance from workspace data.', href: '#resources', color: '#cf7d93', icon: BarChart3 },
  { label: 'Improve with Tavro AI', description: 'Ask questions about workspace information you are allowed to access.', href: '#tavro', color: '#8e91ee', icon: Sparkles },
  { label: 'Call by WorkGrind ID', description: 'Reach eligible users worldwide with a secure call session and a permission-aware global directory.', href: '/calling', color: '#40a887', icon: Phone },
  { label: 'Connect External Apps', description: 'Use scoped API keys with supported WorkGrind records.', href: '#connect-api', color: '#5477d4', icon: Code2 },
];

type ProductModule = { name: string; href: string; icon: LucideIcon; color: string; summary: string; comingSoon?: string };

const workspaceModules: ProductModule[] = [
  { name: 'Overview', href: '/dashboard', icon: LayoutDashboard, color: '#5477d4', summary: 'A company-level view of key metrics, recent activity, tasks, projects, CRM, and upcoming work.' },
  { name: 'Daily Focus', href: '/daily-focus', icon: CheckSquare, color: '#37a986', summary: 'Bring today’s priorities, assigned tasks, deadlines, and meetings into one personal view.' },
  { name: 'Tasks', href: '/tasks', icon: ListChecks, color: '#d99a43', summary: 'Create and assign work, manage subtasks and priorities, set due dates, and track time.' },
  { name: 'Projects', href: '/projects', icon: BriefcaseBusiness, color: '#6c74d8', summary: 'Group related work, coordinate project members, and follow status, progress, and deadlines.', comingSoon: 'Milestone and Gantt timeline planning.' },
  { name: 'Calendar', href: '/calendar', icon: CalendarDays, color: '#299ab1', summary: 'See scheduled meetings, calendar events, deadlines, and due-dated tasks together.' },
];

const collaborationModules: ProductModule[] = [
  { name: 'Chat', href: '/chat', icon: MessageSquare, color: '#4d9ac8', summary: 'Use team channels and direct conversations to discuss work and share files.' },
  { name: 'Meetings', href: '/meetings', icon: Users, color: '#7583d9', summary: 'Plan meetings, invite participants, capture notes and action items, review history, and generate Tavro AI summaries where available.' },
  { name: 'Global Calling', href: '/calling', icon: Phone, color: '#40a887', summary: 'Dial any eligible WorkGrind user by ID with secure peer-to-peer audio and permission-aware discovery.' },
  { name: 'Whiteboard', href: '/whiteboard', icon: Blocks, color: '#d78f4c', summary: 'Think visually with collaborative boards for brainstorming, planning, and diagrams.' },
  { name: 'Docs', href: '/docs', icon: BookOpen, color: '#40a887', summary: 'Create and organize shared documents and keep useful team knowledge together.' },
];

const resourceModules: ProductModule[] = [
  { name: 'Files', href: '/files', icon: FolderOpen, color: '#c28c4d', summary: 'Organize workspace files with folders, search, previews, and sharing controls.' },
  { name: 'Analytics', href: '/analytics', icon: BarChart3, color: '#4c91c5', summary: 'Review metrics drawn from real task, project, CRM, and team activity.' },
  { name: 'Automation', href: '/workflows', icon: Workflow, color: '#38a887', summary: 'Configure supported event triggers and actions such as task creation, notifications, and channel messages.' },
];

const adminModules = [
  { name: 'Team', href: '/team', icon: Users, summary: 'Manage members and roles, and see team-level work and activity.' },
  { name: 'Notifications', href: '/notifications', icon: Bell, summary: 'Review updates and alerts, then manage what needs your attention.' },
  { name: 'Billing', href: '/billing', icon: ClipboardList, summary: 'View plan and usage information and manage the workspace subscription.' },
  { name: 'Settings', href: '/settings', icon: CircleHelp, summary: 'Adjust profile, workspace, security, and personal preferences.' },
];

const day = [
  ['08:30', 'Check Daily Focus', 'Choose priorities and review deadlines for the day.'],
  ['09:00', 'Review Tasks', 'Update task status and decide what to move forward first.'],
  ['10:00', 'Team Meeting', 'Align with participants and capture notes and action items.'],
  ['11:00', 'Update a Project', 'Refresh project status and the progress of connected work.'],
  ['12:00', 'CRM Follow-ups', 'Review a contact or deal and record the next step.'],
  ['14:00', 'Client Portal Message', 'Respond to a client conversation in the separate portal flow.'],
  ['15:00', 'Review a Shared Deliverable', 'Check a file or document shared with a client.'],
  ['16:00', 'Review Analytics', 'Look at current business and team activity.'],
  ['17:00', 'Ask Tavro AI', 'Request a permission-aware summary of workspace activity.'],
];

function ModuleGrid({ modules }: { modules: ProductModule[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {modules.map(({ name, href, icon: Icon, color, summary, comingSoon }) => (
        <RevealOnScroll key={name} className="h-full">
          <Link
            href={href}
            className="group flex h-full min-h-40 flex-col border p-5 transition-colors hover:border-[var(--accent)]"
            style={{ borderColor: 'var(--border-color)', background: 'var(--bg-card)' }}
          >
            <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg" style={{ color, background: `${color}18` }}>
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="flex items-center gap-2 text-base font-bold" style={{ color: 'var(--text-primary)' }}>
              {name}<ArrowRight className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
            </span>
            <span className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{summary}</span>
            {comingSoon && <span className="mt-4 self-start border px-2 py-1 text-[10px] font-semibold" style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}>Coming soon: {comingSoon}</span>}
          </Link>
        </RevealOnScroll>
      ))}
    </div>
  );
}

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      <PublicNavbar />

      <main>
        <section className="relative overflow-hidden bg-[#070b15] text-white">
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:py-24">
            <div>
              <p className="mb-5 inline-flex items-center gap-2 border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-indigo-200">
                <PanelsTopLeft className="h-4 w-4" aria-hidden="true" /> A connected business workspace
              </p>
              <h1 className="max-w-3xl text-4xl font-extrabold leading-tight sm:text-5xl lg:text-6xl">
                Everything Your Team Needs. In One Workspace.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
                WorkGrind brings work, customers, projects, communication, files, automation, and AI together so your team can see what is happening and move it forward.
              </p>
              <div className="mt-8 flex flex-col gap-3 xs:flex-row">
                <Link href="/signup" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-indigo-500">
                  Get Started <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <a href="#how-it-works" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-white/20 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-white/10">
                  Explore WorkGrind <ArrowDown className="h-4 w-4" aria-hidden="true" />
                </a>
              </div>
              <p className="mt-5 text-xs text-slate-400">For teams coordinating delivery, customers, and day-to-day operations.</p>
            </div>

            <div className="border border-white/10 bg-white/[0.035] p-5 sm:p-7" aria-label="WorkGrind workflow from planning to improvement">
              <div className="mb-5 flex items-center justify-between border-b border-white/10 pb-4">
                <span className="text-sm font-bold text-white">One connected workflow</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">WorkGrind</span>
              </div>
              <div className="space-y-2">
                {flow.map(({ label, color, icon: Icon }, index) => (
                  <div key={label} className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ color, background: `${color}1f` }}>
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="flex-1 border border-white/10 bg-white/[0.035] px-3 py-2.5 text-sm font-semibold text-slate-100">{label}</span>
                    <span className="w-6 text-right text-[10px] text-slate-500">0{index + 1}</span>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs leading-relaxed text-slate-400">A product map, not a screenshot: each step connects to a real WorkGrind area below.</p>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="border-b py-14 sm:py-16" style={{ borderColor: 'var(--border-color)' }}>
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionHeading eyebrow="The operating loop" title="How WorkGrind works" description="Plan the work, keep it visible, bring the right people into the conversation, and use the results to decide what comes next." />
            <div className="mt-9 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {flow.map(({ label, description, href, color, icon: Icon }, index) => (
                <RevealOnScroll key={label}>
                  <a href={href} className="flex h-full min-h-36 flex-col border p-4 transition-colors hover:border-[var(--accent)]" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-card)' }}>
                    <span className="flex items-center justify-between">
                      <Icon className="h-5 w-5" style={{ color }} aria-hidden="true" />
                      <span className="text-[10px] font-bold text-[var(--text-muted)]">STEP 0{index + 1}</span>
                    </span>
                    <span className="mt-4 text-sm font-bold">{label}</span>
                    <span className="mt-1.5 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{description}</span>
                  </a>
                </RevealOnScroll>
              ))}
            </div>
          </div>
        </section>

        <section id="workspace" className="py-14 sm:py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionHeading eyebrow="Workspace" title="A clear place for the work" description="WorkGrind is built for teams that need a shared view of delivery and a practical place for each person to focus." />
            <div className="mt-8"><ModuleGrid modules={workspaceModules} /></div>
          </div>
        </section>

        <section id="customers" className="border-y py-14 sm:py-16" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-card)' }}>
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionHeading eyebrow="Customers" title="Keep customer context close to delivery" description="Move from a customer conversation to the people, opportunities, and work connected to it." />
            <div className="mt-8 grid grid-cols-1 gap-3 lg:grid-cols-2">
              <RevealOnScroll>
                <Link href="/crm" className="group flex h-full min-h-64 flex-col border p-6 transition-colors hover:border-[var(--accent)]" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-base)' }}>
                  <span className="flex h-11 w-11 items-center justify-center rounded-lg" style={{ color: '#d89443', background: '#d8944318' }}><Handshake className="h-5 w-5" aria-hidden="true" /></span>
                  <span className="mt-5 flex items-center gap-2 text-lg font-bold">CRM <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100" aria-hidden="true" /></span>
                  <span className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>Keep contacts, companies, leads, deals, pipelines, and customer activity in a shared place, then connect that context to project work.</span>
                  <span className="mt-auto pt-5 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Contacts · Companies · Deals · Pipeline</span>
                </Link>
              </RevealOnScroll>
              <RevealOnScroll>
                <Link href="/client-portal" className="group flex h-full min-h-64 flex-col border p-6 transition-colors hover:border-[var(--accent)]" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-base)' }}>
                  <span className="flex h-11 w-11 items-center justify-center rounded-lg" style={{ color: '#3e9c83', background: '#3e9c8318' }}><ShieldCheck className="h-5 w-5" aria-hidden="true" /></span>
                  <span className="mt-5 flex items-center gap-2 text-lg font-bold">Client Portal <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100" aria-hidden="true" /></span>
                  <span className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>Give clients a separate sign-in experience for explicitly shared projects, files, meetings, documents, and messages, plus client requests and approval decisions.</span>
                  <span className="mt-4 border-l-2 pl-3 text-xs leading-relaxed" style={{ borderColor: '#3e9c83', color: 'var(--text-secondary)' }}>Clients do not enter the employee or admin workspace. Their access is isolated and limited to shared resources.</span>
                  <span className="mt-4 text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>Separate client authentication · Shared resources · Requests · Approval decisions</span>
                </Link>
              </RevealOnScroll>
            </div>
          </div>
        </section>

        <section id="collaboration" className="py-14 sm:py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionHeading eyebrow="Collaboration" title="Keep conversations attached to the work" description="Different ways of working meet in one team workspace, from quick messages to shared documents and visual planning." />
            <div className="mt-8"><ModuleGrid modules={collaborationModules} /></div>
          </div>
        </section>

        <section id="resources" className="border-y py-14 sm:py-16" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-card)' }}>
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionHeading eyebrow="Resources" title="Put information to work" description="Files, analytics, and automation support the everyday operation of the workspace." />
            <div className="mt-8"><ModuleGrid modules={resourceModules} /></div>
            <div className="mt-5 flex items-start gap-3 border-l-2 px-4 py-3 text-xs leading-relaxed" style={{ borderColor: 'var(--accent)', color: 'var(--text-secondary)' }}>
              <GitBranch className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p>Workflows use configured triggers and supported actions. Current actions include creating tasks, sending notifications, and posting channel messages; available behavior depends on the workflow setup.</p>
            </div>
          </div>
        </section>

        <section id="tavro" className="bg-[#101526] py-14 text-white sm:py-16">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
            <RevealOnScroll>
              <div>
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-300/10 text-emerald-300"><Sparkles className="h-5 w-5" aria-hidden="true" /></span>
                <p className="mt-5 text-xs font-bold uppercase tracking-wider text-emerald-300">Intelligence</p>
                <h2 className="mt-2 text-3xl font-extrabold">Meet Tavro AI</h2>
                <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-300">Tavro AI is WorkGrind’s built-in assistant. It can search supported workspace records, help create or update tasks, and summarize workspace information through available tools.</p>
                <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-slate-400"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />Tavro uses authenticated, workspace-scoped tools and respects the caller’s permissions and plan access.</p>
                <Link href="/ai" className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-emerald-300 transition-colors hover:text-white">Explore Tavro AI <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
              </div>
            </RevealOnScroll>
            <RevealOnScroll>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {[
                  ['What needs my attention today?', 'Workspace summary and task search'],
                  ['Show overdue tasks.', 'Search tasks with an overdue filter'],
                  ['Find projects behind schedule.', 'Search projects by deadline and status'],
                  ['Summarize this client.', 'Look up an authorized CRM account'],
                  ['Create a task for a teammate.', 'Create a task; assignment follows role permissions'],
                  ['What is happening across my workspace?', 'Workspace summary from current records'],
                ].map(([prompt, detail]) => (
                  <div key={prompt} className="border border-white/10 bg-white/[0.035] p-4">
                    <p className="text-sm font-semibold text-white">“{prompt}”</p>
                    <p className="mt-2 text-[11px] leading-relaxed text-slate-400">{detail}</p>
                  </div>
                ))}
              </div>
            </RevealOnScroll>
          </div>
        </section>

        <section id="administration" className="py-14 sm:py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionHeading eyebrow="Administration" title="Give the workspace a steady foundation" description="The admin areas help a team manage access, keep up with activity, and maintain its workspace preferences." />
            <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {adminModules.map(({ name, href, icon: Icon, summary }, index) => (
                <RevealOnScroll key={name}>
                  <Link href={href} className="group flex h-full min-h-36 flex-col border p-4 transition-colors hover:border-[var(--accent)]" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-card)' }}>
                    <span className="flex items-center justify-between"><Icon className="h-5 w-5" style={{ color: ['#4f91bd', '#d39347', '#58a98e', '#777bd2'][index] }} aria-hidden="true" /><ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100" aria-hidden="true" /></span>
                    <span className="mt-4 text-sm font-bold">{name}</span>
                    <span className="mt-1.5 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{summary}</span>
                  </Link>
                </RevealOnScroll>
              ))}
            </div>
          </div>
        </section>

        <section id="day" className="border-y py-14 sm:py-16" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-card)' }}>
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionHeading eyebrow="A day with WorkGrind" title="A practical rhythm for a busy team" description="An illustrative workflow, not customer activity or a claim about how every team works." />
            <div className="relative mt-9 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {day.map(([time, title, description], index) => (
                <RevealOnScroll key={time}>
                  <div className="flex h-full min-h-28 gap-4 border p-4" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-base)' }}>
                    <div className="flex w-14 shrink-0 flex-col items-center">
                      <span className="text-xs font-extrabold" style={{ color: 'var(--accent)' }}>{time}</span>
                      <span className="mt-2 flex h-7 w-7 items-center justify-center rounded-full border text-[10px] font-bold" style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}>{String(index + 1).padStart(2, '0')}</span>
                    </div>
                    <div><h3 className="text-sm font-bold">{title}</h3><p className="mt-1.5 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{description}</p></div>
                  </div>
                </RevealOnScroll>
              ))}
            </div>
          </div>
        </section>

        <section id="connections" className="py-14 sm:py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionHeading eyebrow="One connected workspace" title="How the modules connect" description="WorkGrind keeps related information near the work instead of scattering it across disconnected tools." />
            <div className="mt-8 space-y-3">
              <ConnectionRow label="Delivery" items={[["Tasks", '/tasks'], ["Projects", '/projects'], ["Calendar", '/calendar']]} />
              <ConnectionRow label="Customers" items={[["CRM", '/crm'], ["Client Portal", '/client-portal'], ["Projects", '/projects']]} />
              <ConnectionRow label="Teamwork" items={[["Chat", '/chat'], ["Meetings", '/meetings'], ["Docs", '/docs'], ["Files", '/files']]} />
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
              <ConnectionCallout icon={BarChart3} title="Analytics" text="Measures activity across WorkGrind data." href="/analytics" color="#4c91c5" />
              <ConnectionCallout icon={Workflow} title="Automation" text="Connects supported triggers with configured actions." href="/workflows" color="#38a887" />
              <ConnectionCallout icon={Sparkles} title="Tavro AI" text="Works with authorized workspace data and actions." href="/ai" color="#8988e8" />
            </div>
          </div>
        </section>

        <section id="connect-api" className="border-y py-14 sm:py-16" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-card)' }}>
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionHeading eyebrow="Connected business" title="From company operations to your own applications" description="WorkGrind keeps the internal workspace at the center. Phone preferences and API access extend that workflow without implying a provider or integration that is not connected." />
            <div className="mt-8 grid grid-cols-1 items-start gap-6 lg:grid-cols-[0.9fr_1.1fr]">
              <RevealOnScroll>
                <div className="border p-4 sm:p-5" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-base)' }} aria-label="Business operations flow from the company to external websites and apps">
                  <ol className="space-y-2">
                    {[
                      { title: 'Your Business', icon: BriefcaseBusiness, detail: 'People, customers, and day-to-day operations.' },
                      { title: 'WorkGrind', icon: PanelsTopLeft, detail: 'The company workspace and its permissioned modules.' },
                      { title: 'CRM / Projects / Tasks / Team / Client Portal', icon: Handshake, detail: 'Connected customer records, delivery work, employees, and separate client access.' },
                      { title: 'Business Phone', icon: Phone, detail: 'Manual call notes, CRM links, business hours, and routing preferences; provider-dependent calling is Coming Soon.' },
                      { title: 'Connect API', icon: Code2, detail: 'Versioned, scoped endpoints for supported WorkGrind resources.' },
                      { title: 'External Websites & Apps', icon: Globe2, detail: 'Your own server can request or update records allowed by its API key.' },
                    ].map(({ title, icon: Icon, detail }, index, items) => (
                      <li key={title}>
                        <div className="flex items-start gap-3 border p-3" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-card)' }}>
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ color: ['#d99a43', '#5477d4', '#3e9c83', '#40a887', '#6c74d8', '#299ab1'][index], background: 'var(--bg-base)' }}><Icon className="h-4 w-4" aria-hidden="true" /></span>
                          <span className="min-w-0"><span className="block text-sm font-bold">{title}</span><span className="mt-1 block text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{detail}</span></span>
                        </div>
                        {index < items.length - 1 && <ArrowDown className="mx-auto my-1 h-4 w-4" style={{ color: 'var(--text-muted)' }} aria-hidden="true" />}
                      </li>
                    ))}
                  </ol>
                </div>
              </RevealOnScroll>
              <div className="space-y-4">
                <RevealOnScroll>
                  <div id="business-phone" className="border p-5 sm:p-6" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-base)' }}>
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ color: '#40a887', background: '#40a88718' }}><Phone className="h-5 w-5" aria-hidden="true" /></span>
                    <h3 className="mt-4 text-lg font-bold">Business Phone is ready for provider setup</h3>
                    <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>Teams can save company phone references, business hours, routing preferences, and manual call notes linked to CRM contacts. WorkGrind does not place or receive calls, provision numbers, transfer calls, or capture voicemail until a telephony provider is connected.</p>
                  </div>
                </RevealOnScroll>
                <RevealOnScroll>
                  <div className="border p-5 sm:p-6" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-base)' }}>
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ color: '#6c74d8', background: '#6c74d818' }}><Code2 className="h-5 w-5" aria-hidden="true" /></span>
                    <h3 className="mt-4 text-lg font-bold">Connect an external website or app</h3>
                    <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>A business can manage its work in WorkGrind, use Business Phone preferences and manual call notes for communication context, then use a scoped Connect API key from its own server to work with contacts, CRM companies, deals, projects, tasks, and read-only team data.</p>
                    <p className="mt-3 text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>API keys are company-scoped and limited by read/write permissions. Webhook endpoint configurations can be saved, but external event delivery is Coming Soon. No external telephony provider is claimed as live.</p>
                    <Link href="/developer/docs" className="mt-5 inline-flex items-center gap-2 text-sm font-bold" style={{ color: 'var(--accent)' }}>Read the Connect API docs <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
                  </div>
                </RevealOnScroll>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-[#070b15] px-4 py-16 text-center text-white sm:px-6 sm:py-20">
          <RevealOnScroll>
            <div className="mx-auto max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-wider text-indigo-300">Bring the pieces together</p>
              <h2 className="mt-3 text-3xl font-extrabold sm:text-4xl">Ready to bring your work together?</h2>
              <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-slate-300">Explore the WorkGrind modules or take the next step through the existing signup flow.</p>
              <div className="mt-7 flex flex-col justify-center gap-3 xs:flex-row">
                <Link href="/signup" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-indigo-500">Get Started <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
                <Link href="/features" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-white/20 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-white/10">Explore Features <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
              </div>
            </div>
          </RevealOnScroll>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}

function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <RevealOnScroll>
      <div className="max-w-3xl">
        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>{eyebrow}</p>
        <h2 className="mt-2 text-2xl font-extrabold sm:text-3xl">{title}</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed sm:text-base" style={{ color: 'var(--text-secondary)' }}>{description}</p>
      </div>
    </RevealOnScroll>
  );
}

function ConnectionRow({ label, items }: { label: string; items: [string, string][] }) {
  return (
    <RevealOnScroll>
      <div className="grid grid-cols-1 gap-3 border p-4 sm:grid-cols-[130px_1fr] sm:items-center" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-card)' }}>
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{label}</span>
        <div className="flex flex-wrap items-center gap-2">
          {items.map(([name, href], index) => (
            <div key={`${label}-${name}-${index}`} className="flex items-center gap-2">
              <Link href={href} className="inline-flex min-h-10 items-center gap-2 border px-3 py-2 text-xs font-bold transition-colors hover:border-[var(--accent)]" style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
                <span className="h-2 w-2 rounded-full" style={{ background: ['#d99a43', '#6c74d8', '#299ab1', '#40a887'][index % 4] }} aria-hidden="true" />{name}
              </Link>
              {index < items.length - 1 && <ArrowRight className="h-4 w-4 text-[var(--text-muted)]" aria-hidden="true" />}
            </div>
          ))}
        </div>
      </div>
    </RevealOnScroll>
  );
}

function ConnectionCallout({ icon: Icon, title, text, href, color }: { icon: typeof Activity; title: string; text: string; href: string; color: string }) {
  return (
    <RevealOnScroll>
      <Link href={href} className="flex min-h-24 items-center gap-3 border p-4 transition-colors hover:border-[var(--accent)]" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-card)' }}>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ color, background: `${color}18` }}><Icon className="h-4 w-4" aria-hidden="true" /></span>
        <span className="min-w-0"><span className="block text-sm font-bold">{title}</span><span className="mt-1 block text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{text}</span></span>
        <ArrowUpDown className="ml-auto h-4 w-4 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
      </Link>
    </RevealOnScroll>
  );
}