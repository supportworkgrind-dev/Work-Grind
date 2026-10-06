import type { Metadata } from 'next';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowRight,
  BarChart3,
  Bell,
  BookOpen,
  BriefcaseBusiness,
  CalendarDays,
  CheckSquare,
  Code2,
  CircleHelp,
  ClipboardList,
  FileText,
  FolderOpen,
  Globe2,
  Handshake,
  LayoutDashboard,
  ListChecks,
  MessageSquare,
  PanelsTopLeft,
  Phone,
  ShieldCheck,
  Sparkles,
  Users,
  Workflow,
} from 'lucide-react';
import { PublicFooter } from '@/components/landing/PublicFooter';
import { PublicNavbar } from '@/components/landing/PublicNavbar';
import { RevealOnScroll } from '@/components/landing/RevealOnScroll';

export const metadata: Metadata = {
  title: 'WorkGrind Features | Real Workflow, CRM, AI, and Client Portal Tools',
  description: 'Explore the actual WorkGrind feature set: daily focus, tasks, projects, CRM, client portal, chat, meetings, documents, files, analytics, automation, and Tavro AI.',
  openGraph: {
    title: 'WorkGrind Features | Real Workflow, CRM, AI, and Client Portal Tools',
    description: 'See the modules WorkGrind includes today: daily planning, customer context, secure client access, automation, analytics, and Tavro AI.',
    url: '/features',
    siteName: 'WorkGrind',
    type: 'website',
    images: [{ url: '/workgrind-icon.svg', width: 512, height: 512, alt: 'WorkGrind logo' }],
  },
  twitter: {
    card: 'summary',
    title: 'WorkGrind Features',
    description: 'A practical overview of the WorkGrind workspace and client-facing tools that are implemented today.',
    images: ['/workgrind-icon.svg'],
  },
};

type FeatureTile = {
  name: string;
  href: string;
  icon: LucideIcon;
  color: string;
  summary: string;
  tag?: string;
};

const operatingModules: FeatureTile[] = [
  { name: 'Overview', href: '/dashboard', icon: LayoutDashboard, color: '#5477d4', summary: 'A team-wide snapshot of activity, tasks, projects, CRM signals, and upcoming priorities.', tag: 'Workspace' },
  { name: 'Daily Focus', href: '/daily-focus', icon: CheckSquare, color: '#37a986', summary: 'Keep today’s priorities, assigned work, deadlines, and meetings in one personal view.', tag: 'Planning' },
  { name: 'Tasks', href: '/tasks', icon: ListChecks, color: '#d99a43', summary: 'Create work, assign owners, set due dates, track status, and move priorities forward.', tag: 'Execution' },
  { name: 'Projects', href: '/projects', icon: BriefcaseBusiness, color: '#6c74d8', summary: 'Organize related work into projects with clear ownership, progress, and deadlines.', tag: 'Delivery' },
  { name: 'Calendar', href: '/calendar', icon: CalendarDays, color: '#299ab1', summary: 'See meetings, due dates, and time-sensitive work in one shared schedule.', tag: 'Scheduling' },
  { name: 'CRM', href: '/crm', icon: Handshake, color: '#d89443', summary: 'Keep companies, contacts, deals, and customer context attached to the work.', tag: 'Customers' },
];

const collaborationModules: FeatureTile[] = [
  { name: 'Chat', href: '/chat', icon: MessageSquare, color: '#4d9ac8', summary: 'Use team channels and direct conversations to keep context close to the work.', tag: 'Communication' },
  { name: 'Meetings', href: '/meetings', icon: Users, color: '#7583d9', summary: 'Schedule meetings, review notes, and capture action items tied to follow-up work.', tag: 'Meetings' },
  { name: 'Whiteboard', href: '/whiteboard', icon: PanelsTopLeft, color: '#d78f4c', summary: 'Visualize ideas, planning, and team thinking in a collaborative board space.', tag: 'Planning' },
  { name: 'Docs', href: '/docs', icon: BookOpen, color: '#40a887', summary: 'Create and organize shared documents that keep team knowledge in one place.', tag: 'Knowledge' },
  { name: 'Files', href: '/files', icon: FolderOpen, color: '#c28c4d', summary: 'Organize workspace files with folders, previews, and search for the documents teams use every day.', tag: 'Content' },
  { name: 'Notifications', href: '/notifications', icon: Bell, color: '#4c91c5', summary: 'Review updates, stay on top of assigned work, and move from alert to action quickly.', tag: 'Signals' },
];

const operatingSystems: FeatureTile[] = [
  { name: 'Analytics', href: '/analytics', icon: BarChart3, color: '#4c91c5', summary: 'Review task, project, CRM, and workspace activity to understand what is moving and what needs attention.', tag: 'Insights' },
  { name: 'Automation', href: '/workflows', icon: Workflow, color: '#38a887', summary: 'Use supported triggers and configured actions for task creation, alerts, and channel updates.', tag: 'Automation' },
  { name: 'Tavro AI', href: '/ai', icon: Sparkles, color: '#8e91ee', summary: 'Ask permission-aware questions about supported workspace data and create or update approved records through available tools.', tag: 'AI' },
  { name: 'Client Portal', href: '/client-portal', icon: ShieldCheck, color: '#3e9c83', summary: 'Give clients a separate, permission-scoped place for shared project updates, messages, and approvals.', tag: 'External access' },
  { name: 'Team', href: '/team', icon: Users, color: '#5d78d8', summary: 'Manage people, roles, and the shared operational context behind the workspace.', tag: 'Access' },
  { name: 'Settings', href: '/settings', icon: CircleHelp, color: '#7b78ea', summary: 'Adjust personal and workspace preferences so the system matches how your team works.', tag: 'Admin' },
];

const connectionFeatures: FeatureTile[] = [
  { name: 'Global Calling', href: '/calling', icon: Phone, color: '#40a887', summary: 'Use a WorkGrind Calling ID to reach any eligible user worldwide with secure audio and permission-aware call discovery.', tag: 'Global voice' },
  { name: 'Connect API', href: '/developer/docs', icon: Code2, color: '#5477d4', summary: 'Connect a company website or application to scoped Contacts, CRM Companies, Deals, Projects, Tasks, and read-only Team endpoints.', tag: 'Versioned API' },
  { name: 'API Keys', href: '/developer', icon: ShieldCheck, color: '#37a986', summary: 'Owners and admins can create scoped read/write keys, see each secret once, then rotate or revoke access.', tag: 'Developer access' },
  { name: 'Webhooks', href: '/developer', icon: Workflow, color: '#d78f4c', summary: 'Save HTTPS endpoints and event labels for a workspace. External event delivery is Coming Soon.', tag: 'Delivery coming soon' },
  { name: 'External websites & apps', href: '/how-it-works#connect-api', icon: Globe2, color: '#299ab1', summary: 'Use the Connect API from a trusted server to read or update the WorkGrind resources allowed by its key scopes.', tag: 'Scoped connectivity' },
];

const governanceModules: FeatureTile[] = [
  { name: 'Billing', href: '/billing', icon: ClipboardList, color: '#5eb0a2', summary: 'Review plan details and subscription information from the workspace admin side.', tag: 'Plan' },
  { name: 'Files + Docs', href: '/files', icon: FileText, color: '#d78857', summary: 'Keep shared, client-facing, and internal documents in the same operating system.', tag: 'Knowledge' },
];

function ModuleGrid({ modules }: { modules: FeatureTile[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {modules.map(({ name, href, icon: Icon, color, summary, tag }) => (
        <RevealOnScroll key={name} className="h-full">
          <Link
            href={href}
            className="group flex h-full min-h-44 flex-col border p-5 transition-colors hover:border-[var(--accent)]"
            style={{ borderColor: 'var(--border-color)', background: 'var(--bg-card)' }}
          >
            <div className="flex items-start justify-between gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ color, background: `${color}18` }}>
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              {tag && (
                <span className="border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}>
                  {tag}
                </span>
              )}
            </div>
            <span className="mt-5 flex items-center gap-2 text-base font-bold" style={{ color: 'var(--text-primary)' }}>
              {name}
              <ArrowRight className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
            </span>
            <span className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{summary}</span>
          </Link>
        </RevealOnScroll>
      ))}
    </div>
  );
}

export default function FeaturesPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      <PublicNavbar />

      <main>
        <section className="relative overflow-hidden bg-[#070b15] text-white">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
            <div className="mx-auto max-w-3xl text-center">
              <p className="mb-5 inline-flex items-center gap-2 border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-indigo-200">
                <PanelsTopLeft className="h-4 w-4" aria-hidden="true" /> Features overview
              </p>
              <h1 className="text-4xl font-extrabold leading-tight sm:text-5xl lg:text-6xl">
                A workspace built around the real work.
              </h1>
              <p className="mt-6 text-base leading-relaxed text-slate-300 sm:text-lg">
                WorkGrind brings planning, delivery, customer context, collaboration, secure external access, automation, and AI into a single operating system that matches the way teams already work.
              </p>
              <div className="mt-8 flex flex-col justify-center gap-3 xs:flex-row">
                <Link href="/signup" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-indigo-500">
                  Get Started <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link href="/how-it-works" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-white/20 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-white/10">
                  See How It Works <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="py-14 sm:py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionHeading
              eyebrow="Operating system"
              title="Core work, customer context, and daily execution"
              description="These are the main product areas WorkGrind includes for day-to-day business operations."
            />
            <div className="mt-8"><ModuleGrid modules={operatingModules} /></div>
          </div>
        </section>

        <section className="border-y py-14 sm:py-16" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-card)' }}>
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionHeading
              eyebrow="Collaboration"
              title="Keep conversations, knowledge, and files close to the work"
              description="WorkGrind gives teams the communication and document systems they need to plan, align, and move work forward together."
            />
            <div className="mt-8"><ModuleGrid modules={collaborationModules} /></div>
          </div>
        </section>

        <section className="py-14 sm:py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionHeading
              eyebrow="Operations"
              title="Automation, analytics, and intelligent support"
              description="The workspace does more than track work: it helps teams understand activity, automate routine steps, and use supported AI tools with the right permissions."
            />
            <div className="mt-8"><ModuleGrid modules={operatingSystems} /></div>
          </div>
        </section>

        <section className="border-y py-14 sm:py-16" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-card)' }}>
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionHeading
              eyebrow="Business connections"
              title="Connect company operations and external apps"
              description="Global Calling and the WorkGrind Connect API extend the workspace without exposing workspace-only data through a company-phone concept."
            />
            <div className="mt-8"><ModuleGrid modules={connectionFeatures} /></div>
          </div>
        </section>

        <section className="border-t py-14 sm:py-16" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-card)' }}>
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionHeading
              eyebrow="Administration"
              title="Keep the workspace healthy and govern access"
              description="The admin side helps teams manage roles, billing, preferences, and the operational infrastructure behind the workspace."
            />
            <div className="mt-8"><ModuleGrid modules={governanceModules} /></div>
          </div>
        </section>

        <section className="bg-[#070b15] px-4 py-16 text-center text-white sm:px-6 sm:py-20">
          <RevealOnScroll>
            <div className="mx-auto max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-wider text-indigo-300">Built for real operating teams</p>
              <h2 className="mt-3 text-3xl font-extrabold sm:text-4xl">Everything your team needs to run work and client relationships together.</h2>
              <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-slate-300">WorkGrind brings the essentials into one workspace without adding fake promises or unsupported features.</p>
              <div className="mt-7 flex flex-col justify-center gap-3 xs:flex-row">
                <Link href="/signup" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-indigo-500">Get Started <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
                <Link href="/how-it-works" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-white/20 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-white/10">Learn the workflow <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
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
