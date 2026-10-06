'use client';

import Link from 'next/link';
import { ArrowLeft, ArrowRight, BookOpen, Braces, Code2, ShieldCheck } from 'lucide-react';

const resources = [
  { name: 'Contacts', path: 'contacts', reads: 'GET /contacts, GET /contacts/:id', writes: 'POST /contacts, PATCH /contacts/:id', fields: 'firstName, lastName, email, phone, jobTitle, department, crmCompanyId, status, tags, notes, linkedInUrl, lastContactedAt' },
  { name: 'CRM companies', path: 'companies', reads: 'GET /companies, GET /companies/:id', writes: 'POST /companies, PATCH /companies/:id', fields: 'name, domain, website, industry, employeeCount, annualRevenue, country, city, address, phone, tags, notes, linkedInUrl' },
  { name: 'Deals', path: 'deals', reads: 'GET /deals, GET /deals/:id', writes: 'POST /deals, PATCH /deals/:id', fields: 'title, value, currency, stage, priority, contactId, crmCompanyId, closeDate, probability, description, tags, lostReason' },
  { name: 'Projects', path: 'projects', reads: 'GET /projects, GET /projects/:id', writes: 'POST /projects, PATCH /projects/:id', fields: 'name, crmCompanyId, description, color, priority, assigneeId, startDate, deadline, status' },
  { name: 'Tasks', path: 'tasks', reads: 'GET /tasks, GET /tasks/:id', writes: 'POST /tasks, PATCH /tasks/:id', fields: 'title, description, projectId, assigneeId, priority, status, startDate, dueDate, estimatedMinutes, tags, subtasks' },
  { name: 'Team members', path: 'team', reads: 'GET /team, GET /team/:id', writes: 'Read only', fields: 'id, fullName, email, role, jobTitle, department, avatar, status, lastSeen, createdAt' },
];

export default function ConnectApiDocsPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link href="/developer" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent)]"><ArrowLeft className="h-4 w-4" />Developer workspace</Link>
      <header className="rounded-xl border theme-border theme-bg-card p-5 sm:p-7">
        <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--accent)]/10 text-[var(--accent)]"><BookOpen className="h-5 w-5" /></span><div><p className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">Developer reference</p><h1 className="mt-1 text-2xl font-bold theme-text-primary">WorkGrind Connect API</h1></div></div>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed theme-text-secondary">Use a scoped API key to connect a website or application you operate to WorkGrind CRM and delivery records. Requests are versioned under <code>/api/v1</code> and always restricted to the workspace that owns the key.</p>
        <div className="mt-5 grid grid-cols-1 gap-2 md:grid-cols-3" aria-label="External application connection flow">{['External website or app', 'WorkGrind API key', 'Contacts / Companies / Deals / Projects / Tasks'].map((item, index) => <div key={item} className="flex items-center gap-2 rounded-lg border theme-border p-3 text-xs font-semibold theme-text-primary"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/10 text-[var(--accent)]">{index + 1}</span>{item}{index < 2 && <ArrowRight className="ml-auto hidden h-4 w-4 theme-text-muted md:block" />}</div>)}</div>
      </header>

      <section className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" /><div><h2 className="text-sm font-bold theme-text-primary">Keep API keys on a trusted server</h2><p className="mt-1 text-xs leading-relaxed theme-text-secondary">Do not embed a key in browser JavaScript, a public mobile app, or source control. Send it from your server using the Authorization header. WorkGrind stores only a hash and displays a key once at creation or rotation.</p></div></div></section>

      <section className="rounded-xl border theme-border theme-bg-card p-4 sm:p-5"><h2 className="flex items-center gap-2 text-base font-bold theme-text-primary"><Code2 className="h-4 w-4 text-[var(--accent)]" />Authenticate a request</h2><p className="mt-2 text-sm theme-text-secondary">Set the Authorization header to a key created in the Developer workspace. The base URL is the host serving your WorkGrind API.</p><CodeBlock>{`curl "https://<your-workgrind-api-host>/api/v1/contacts?limit=5" \\
  -H "Authorization: Bearer <YOUR_WORKGRIND_API_KEY>" \\
  -H "Accept: application/json"`}</CodeBlock><p className="mt-3 text-xs theme-text-muted">List endpoints accept <code>page</code> and <code>limit</code> (maximum 100); CRM resources also accept <code>q</code>. Responses include pagination metadata. The per-key rate limit is 120 requests per minute and is returned in rate-limit headers.</p></section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section className="rounded-xl border theme-border theme-bg-card p-4 sm:p-5"><h2 className="flex items-center gap-2 text-base font-bold theme-text-primary"><Braces className="h-4 w-4 text-[var(--accent)]" />Create a CRM contact</h2><p className="mt-2 text-sm theme-text-secondary">Use the <code>contacts:write</code> scope. Ownership is assigned from the API key; a supplied company ID must belong to the same workspace.</p><CodeBlock>{`curl -X POST "https://<your-workgrind-api-host>/api/v1/contacts" \\
  -H "Authorization: Bearer <YOUR_WORKGRIND_API_KEY>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "firstName": "<first name>",
    "lastName": "<last name>",
    "email": "<email address>"
  }'`}</CodeBlock><p className="mt-3 text-xs font-semibold theme-text-muted">Response shape</p><CodeBlock>{`{
  "success": true,
  "data": {
    "id": "<created CRM contact id>",
    "firstName": "<stored firstName>",
    "lastName": "<stored lastName>",
    "companyId": "<key workspace id>"
  }
}`}</CodeBlock></section>
        <section className="rounded-xl border theme-border theme-bg-card p-4 sm:p-5"><h2 className="flex items-center gap-2 text-base font-bold theme-text-primary"><Braces className="h-4 w-4 text-[var(--accent)]" />Read tasks</h2><p className="mt-2 text-sm theme-text-secondary">Use <code>tasks:read</code>. Create or update tasks with <code>tasks:write</code>. Company and creator fields cannot be overridden.</p><CodeBlock>{`curl "https://<your-workgrind-api-host>/api/v1/tasks?limit=25" \\
  -H "Authorization: Bearer <YOUR_WORKGRIND_API_KEY>"`}</CodeBlock><p className="mt-3 text-xs font-semibold theme-text-muted">Response shape</p><CodeBlock>{`{
  "success": true,
  "data": [
    {
      "id": "<task id>",
      "title": "<stored title>",
      "status": "<stored status>",
      "companyId": "<key workspace id>"
    }
  ],
  "pagination": { "page": 1, "limit": 25, "total": "<record count>", "pages": "<page count>" }
}`}</CodeBlock></section>
      </div>

      <section className="overflow-hidden rounded-xl border theme-border theme-bg-card">
        <div className="border-b theme-border p-4"><h2 className="text-base font-bold theme-text-primary">Available resources and scopes</h2><p className="mt-1 text-xs theme-text-muted">Write requests support create and partial update. Team is read-only. Delete operations are not available through this API.</p></div>
        <div className="divide-y theme-border">{resources.map((resource) => <article key={resource.path} className="grid grid-cols-1 gap-2 p-4 lg:grid-cols-[130px_1fr_1fr]"><h3 className="text-sm font-bold theme-text-primary">{resource.name}</h3><div><p className="text-[10px] font-bold uppercase tracking-wider theme-text-muted">Read · {resource.path}:read</p><p className="mt-1 text-xs theme-text-secondary">{resource.reads}</p></div><div><p className="text-[10px] font-bold uppercase tracking-wider theme-text-muted">Write · {resource.path}:write</p><p className="mt-1 text-xs theme-text-secondary">{resource.writes}</p><p className="mt-1 break-words text-[11px] leading-relaxed theme-text-muted">Writable fields: {resource.fields}</p></div></article>)}</div>
      </section>

      <section className="rounded-xl border theme-border theme-bg-card p-4 sm:p-5"><h2 className="text-base font-bold theme-text-primary">Response and access behavior</h2><div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2"><p className="text-xs leading-relaxed theme-text-secondary"><code>success</code> indicates the operation result. Errors return <code>success: false</code> with an <code>error.code</code> and message. Invalid keys return 401, insufficient scopes return 403, and out-of-workspace records are not found.</p><p className="text-xs leading-relaxed theme-text-secondary">Related CRM contacts, companies, projects, and teammates are checked against the same workspace. API request logs omit secrets, request bodies, query strings, and phone data.</p></div></section>

      <section className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4"><h2 className="text-sm font-bold theme-text-primary">Webhooks and real-time collaboration</h2><p className="mt-1 text-xs leading-relaxed theme-text-secondary">Webhook endpoint configurations can be managed now, but external event delivery is not enabled. WorkGrind Calling remains a first-class capability built around secure WorkGrind IDs rather than provider-specific phone settings.</p></section>
    </div>
  );
}

function CodeBlock({ children }: { children: string }) {
  return <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-950 p-3 text-xs leading-relaxed text-slate-100"><code>{children}</code></pre>;
}
