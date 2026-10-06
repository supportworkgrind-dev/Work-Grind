import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicFooter } from '@/components/landing/PublicFooter';
import { PublicNavbar } from '@/components/landing/PublicNavbar';
import { ArrowUpRight, BookOpen } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Help Center | WorkGrind',
  description: 'Guides to WorkGrind accounts, workspaces, collaboration, and billing.',
};

const topics = [
  { title: 'Getting started', description: 'Create an account, verify your email, and set up a workspace.', href: '/signup', label: 'Sign up' },
  { title: 'Account', description: 'Manage your profile, preferences, security, and sign-in recovery.', href: '/settings', label: 'Account settings' },
  { title: 'Workspace', description: 'Manage workspace members, roles, and invitations.', href: '/team', label: 'Team' },
  { title: 'Tasks', description: 'Create and organize tasks, statuses, priorities, and assignees.', href: '/tasks', label: 'Tasks' },
  { title: 'Projects', description: 'Group and track work across projects.', href: '/projects', label: 'Projects' },
  { title: 'Calendar', description: 'Review and manage scheduled events and meetings.', href: '/calendar', label: 'Calendar' },
  { title: 'CRM', description: 'Manage contacts, companies, and deal records.', href: '/crm', label: 'CRM' },
  { title: 'Client Portal', description: 'Manage client access and shared portal work.', href: '/client-portal-mgmt', label: 'Client portal management' },
  { title: 'Chat', description: 'Use channels and direct messages to collaborate.', href: '/chat', label: 'Chat' },
  { title: 'Meetings', description: 'Schedule and join workspace meetings.', href: '/meetings', label: 'Meetings' },
  { title: 'Calling', description: 'Start or receive WorkGrind calls and manage call settings.', href: '/calling', label: 'Calling' },
  { title: 'Files', description: 'Upload, organize, share, and manage workspace files.', href: '/files', label: 'Files' },
  { title: 'Billing', description: 'Review your workspace plan, storage limits, and subscription actions.', href: '/billing', label: 'Billing' },
  { title: 'Tavro AI', description: 'Use the AI features available in your configured workspace.', href: '/ai', label: 'Tavro AI' },
  { title: 'Security', description: 'Review account and workspace security guidance.', href: '/security', label: 'Security policy' },
  { title: 'Troubleshooting', description: 'If a feature fails, refresh the page, confirm access with your workspace administrator, and report the page and error through the contact form.', href: '/contact', label: 'Contact WorkGrind' },
];

export default function HelpCenterPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <PublicNavbar />
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8 max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-indigo-700">
            <BookOpen className="h-3.5 w-3.5" /> WorkGrind Help Center
          </span>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">Find your way around WorkGrind</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">Quick links and practical starting points for the features currently available in WorkGrind.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {topics.map((topic) => (
            <Link key={topic.title} href={topic.href} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-indigo-300 hover:shadow-md">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-base font-bold text-slate-900">{topic.title}</h2>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:text-indigo-600" />
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">{topic.description}</p>
              <span className="mt-4 inline-block text-xs font-semibold text-indigo-600">{topic.label}</span>
            </Link>
          ))}
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
