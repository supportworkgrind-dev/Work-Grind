'use client';

import { useEffect, useState } from 'react';
import { CalendarClock, Check, Eye, LoaderCircle, Pencil, Send, Sparkles, ThumbsDown, Trash2, X } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';
import { LinkedInConnection, LinkedInConnectionCard } from './LinkedInConnectionCard';

type SocialPost = {
  _id: string;
  text: string;
  platform: 'linkedin' | 'instagram' | 'facebook' | 'youtube';
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'scheduled' | 'publishing' | 'published' | 'failed';
  authorId?: { _id: string; fullName: string };
  reviewerId?: { _id: string; fullName: string };
  rejectionReason?: string;
  linkedinPostUrn?: string;
  linkedinPostUrl?: string;
  failureCode?: string;
  updatedAt: string;
  publishedAt?: string;
  scheduledAt?: string;
  scheduleTimeZone?: string;
};

type SocialProvider = {
  id: 'linkedin' | 'instagram' | 'facebook' | 'youtube';
  name: string;
  availability: 'available' | 'setup_required' | 'coming_soon';
  capabilities: { connect: boolean; publishText: boolean; publishMedia: boolean; schedule: boolean; analytics: boolean; organizationPublishing: boolean };
};

const statusLabel: Record<SocialPost['status'], string> = {
  draft: 'Draft',
  pending_approval: 'Pending approval',
  approved: 'Approved',
  rejected: 'Rejected',
  scheduled: 'Scheduled',
  publishing: 'Publishing',
  published: 'Published',
  failed: 'Failed',
};

export function SocialPublishingPanel() {
  const { user } = useAuthStore();
  const canReview = ['owner', 'founder', 'admin', 'principal', 'director', 'office_staff', 'dean', 'hod'].includes(user?.role ?? '');
  const isManager = user?.role === 'manager';
  const [connection, setConnection] = useState<LinkedInConnection | null>(null);
  const [providers, setProviders] = useState<SocialProvider[]>([]);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [topic, setTopic] = useState('');
  const [details, setDetails] = useState('');
  const [style, setStyle] = useState('professional update');
  const [tone, setTone] = useState('professional');
  const [selectedPlatform, setSelectedPlatform] = useState<SocialProvider['id']>('linkedin');
  const [scheduleLocal, setScheduleLocal] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refreshPosts = async () => {
    const response = await api.get('/social-publishing/posts');
    setPosts(response.data.posts as SocialPost[]);
  };

  useEffect(() => {
    let active = true;
    Promise.all([
      api.get('/social-publishing/posts'),
      api.get('/social-publishing/providers'),
    ])
      .then(([postsResponse, providersResponse]) => {
        if (!active) return;
        setPosts(postsResponse.data.posts as SocialPost[]);
        setProviders(providersResponse.data.providers as SocialProvider[]);
      })
      .catch((requestError: unknown) => {
        if (active) {
          const message = (requestError as { response?: { data?: { message?: string } } }).response?.data?.message;
          setError(message || 'Social Publishing could not be loaded.');
        }
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const saveDraft = async () => {
    if (!text.trim() || text.trim().length > 3000) {
      setError('Enter post text between 1 and 3000 characters.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (editingId) await api.patch(`/social-publishing/posts/${editingId}`, { text: text.trim() });
      else await api.post('/social-publishing/posts', { text: text.trim(), platform: selectedPlatform });
      await refreshPosts();
      setText('');
      setEditingId(null);
      setPreview(false);
      setNotice('Draft saved.');
    } catch (requestError: unknown) {
      const message = (requestError as { response?: { data?: { message?: string } } }).response?.data?.message;
      setError(message || 'The draft could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  const generateDraft = async () => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await api.post('/social-publishing/draft/generate', { topic, details, style, tone, platform: selectedPlatform });
      setText(response.data.draft);
      setPreview(false);
      setNotice('Tavro generated a draft. Review and edit it before saving or publishing.');
    } catch (requestError: unknown) {
      const message = (requestError as { response?: { data?: { message?: string } } }).response?.data?.message;
      setError(message || 'Tavro could not generate a draft.');
    } finally {
      setBusy(false);
    }
  };

  const transformDraft = async (operation: 'rewrite' | 'shorten' | 'improve' | 'tone') => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await api.post('/social-publishing/draft/generate', {
        operation, text, topic, details, tone, style, platform: selectedPlatform,
      });
      setText(response.data.draft);
      setPreview(false);
      setNotice('Tavro prepared an editable revision. Review it before saving or publishing.');
    } catch (requestError: unknown) {
      const message = (requestError as { response?: { data?: { message?: string } } }).response?.data?.message;
      setError(message || 'Tavro could not revise this draft.');
    } finally {
      setBusy(false);
    }
  };

  const schedulePost = async (post: SocialPost) => {
    if (!scheduleLocal) {
      setError('Choose the date and time for this post first.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api.post(`/social-publishing/posts/${post._id}/schedule`, {
        scheduledAt: new Date(scheduleLocal).toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      await refreshPosts();
      setNotice('Post scheduled. WorkGrind will publish it at the selected time.');
    } catch (requestError: unknown) {
      const message = (requestError as { response?: { data?: { message?: string } } }).response?.data?.message;
      setError(message || 'The post could not be scheduled.');
    } finally {
      setBusy(false);
    }
  };

  const cancelSchedule = async (post: SocialPost) => {
    setBusy(true);
    setError('');
    try {
      await api.delete(`/social-publishing/posts/${post._id}/schedule`);
      await refreshPosts();
      setNotice('Scheduled publication cancelled.');
    } catch (requestError: unknown) {
      const message = (requestError as { response?: { data?: { message?: string } } }).response?.data?.message;
      setError(message || 'The scheduled post could not be cancelled.');
    } finally {
      setBusy(false);
    }
  };

  const deleteDraft = async (post: SocialPost) => {
    if (!window.confirm('Delete this draft? This cannot be undone.')) return;
    setBusy(true);
    setError('');
    try {
      await api.delete(`/social-publishing/posts/${post._id}`);
      await refreshPosts();
      setNotice('Draft deleted.');
    } catch (requestError: unknown) {
      const message = (requestError as { response?: { data?: { message?: string } } }).response?.data?.message;
      setError(message || 'The draft could not be deleted.');
    } finally {
      setBusy(false);
    }
  };

  const runPostAction = async (post: SocialPost, action: string, confirmPublish = false) => {
    if (confirmPublish && !window.confirm('Publish this text post to the connected LinkedIn member profile now?')) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await api.post(`/social-publishing/posts/${post._id}/${action}`);
      await refreshPosts();
      setNotice(action === 'publish'
        ? 'LinkedIn confirmed the post was published.'
        : action === 'request-approval'
          ? 'Draft submitted for approval.'
          : `Post ${action === 'approve' ? 'approved' : 'rejected'}.`);
      if (response.data.post?.linkedinPostUrl) setNotice(`Published: ${response.data.post.linkedinPostUrl}`);
    } catch (requestError: unknown) {
      const message = (requestError as { response?: { data?: { message?: string } } }).response?.data?.message;
      setError(message || 'That action could not be completed.');
      await refreshPosts().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  };

  const beginEdit = (post: SocialPost) => {
    setEditingId(post._id);
    setText(post.text);
    setPreview(false);
    setError('');
    setNotice('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const canPublish = (post: SocialPost) => connection?.canPublishMemberPosts &&
    (canReview ? post.status === 'draft' || post.status === 'approved' : isManager && post.status === 'approved');

  return (
    <div className="space-y-5">
      <LinkedInConnectionCard
        onConnectionChange={setConnection}
        returnTo="/social-publishing"
        canDisconnect={canReview}
      />

      <section className="surface rounded-2xl border p-4 sm:p-5" aria-labelledby="social-providers-heading">
        <h2 id="social-providers-heading" className="text-sm font-semibold theme-text-primary">Publishing destinations</h2>
        <p className="mt-1 text-xs theme-text-muted">Capabilities are provider-specific. Only connected, verified destinations can be selected.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {providers.map((provider) => {
            const enabled = provider.capabilities.publishText;
            return (
              <button
                key={provider.id}
                type="button"
                disabled={!enabled}
                aria-pressed={selectedPlatform === provider.id}
                onClick={() => setSelectedPlatform(provider.id)}
                className={`rounded-lg border px-3 py-2 text-xs font-medium ${
                  selectedPlatform === provider.id ? 'border-[var(--accent)] bg-[var(--bg-active)] theme-text-primary' : 'theme-text-secondary'
                } disabled:cursor-not-allowed disabled:opacity-60`}
                title={enabled ? `${provider.name} publishing is available.` : `${provider.name} requires provider setup and approval.`}
              >
                {provider.name} · {enabled ? 'Available' : provider.availability === 'setup_required' ? 'Setup required' : 'Coming soon'}
              </button>
            );
          })}
        </div>
      </section>

      <section className="surface rounded-2xl border p-4 sm:p-5">
        <div className="mb-4">
          <h2 className="text-base font-semibold theme-text-primary">Create a LinkedIn post</h2>
          <p className="mt-1 text-xs theme-text-muted">Drafts are private to this workspace. Tavro only writes draft text; it never publishes.</p>
        </div>

        {error && <p role="alert" className="mb-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        {notice && <p role="status" className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</p>}

        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_190px]">
          <label className="text-xs font-medium theme-text-secondary">
            Topic
            <input value={topic} onChange={(event) => setTopic(event.target.value)} maxLength={500} placeholder="What should the post be about?" className="input-premium mt-1 w-full" />
          </label>
          <label className="text-xs font-medium theme-text-secondary">
            Draft type
            <select value={style} onChange={(event) => setStyle(event.target.value)} className="input-premium mt-1 w-full">
              <option value="professional update">Professional update</option>
              <option value="product announcement">Product announcement</option>
              <option value="marketing post">Marketing post</option>
              <option value="event promotion">Event promotion</option>
            </select>
          </label>
        </div>
        <label className="mt-3 block text-xs font-medium theme-text-secondary sm:max-w-xs">
          Writing tone
          <select value={tone} onChange={(event) => setTone(event.target.value)} className="input-premium mt-1 w-full">
            <option value="professional">Professional</option>
            <option value="friendly">Friendly</option>
            <option value="confident">Confident</option>
            <option value="informative">Informative</option>
          </select>
        </label>
        <label className="mt-3 block text-xs font-medium theme-text-secondary">
          Optional facts and context
          <textarea value={details} onChange={(event) => setDetails(event.target.value)} maxLength={1500} rows={2} placeholder="Include only claims and details you want Tavro to use." className="input-premium mt-1 w-full resize-y" />
        </label>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => void generateDraft()} disabled={busy || !topic.trim() || !providers.find((provider) => provider.id === selectedPlatform)?.capabilities.publishText} className="btn-ghost inline-flex h-9 items-center gap-2 px-3 text-xs disabled:opacity-50">
            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Generate with Tavro
          </button>
          {(['rewrite', 'shorten', 'improve', 'tone'] as const).map((operation) => (
            <button key={operation} type="button" onClick={() => void transformDraft(operation)} disabled={busy || !text.trim()} className="btn-ghost inline-flex h-9 items-center gap-2 px-3 text-xs disabled:opacity-50">
              {operation === 'tone' ? 'Adjust tone' : operation[0].toUpperCase() + operation.slice(1)}
            </button>
          ))}
        </div>

        <div className="mt-4 border-t pt-4" style={{ borderColor: 'var(--border-color)' }}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <label htmlFor="linkedin-post-text" className="text-xs font-semibold theme-text-secondary">Post text</label>
            <button type="button" onClick={() => setPreview(!preview)} className="btn-ghost inline-flex h-8 items-center gap-1.5 px-2 text-xs">
              {preview ? <Pencil className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {preview ? 'Edit' : 'Preview'}
            </button>
          </div>
          {preview
            ? <div className="min-h-32 whitespace-pre-wrap rounded-xl border p-3 text-sm theme-text-primary" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-base)' }}>{text || 'Your post preview will appear here.'}</div>
            : <textarea id="linkedin-post-text" value={text} onChange={(event) => setText(event.target.value)} maxLength={3000} rows={6} placeholder="Write a post or generate a draft with Tavro." className="input-premium w-full resize-y" />}
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <span className={`text-xs ${text.length > 3000 ? 'text-rose-600' : 'theme-text-muted'}`}>{text.length}/3000</span>
            <div className="flex gap-2">
              {editingId && <button type="button" onClick={() => { setEditingId(null); setText(''); }} className="btn-ghost h-9 px-3 text-xs">Cancel edit</button>}
              <button type="button" onClick={() => void saveDraft()} disabled={busy || !text.trim()} className="btn-primary inline-flex h-9 items-center gap-2 px-3 text-xs disabled:opacity-50">
                {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {editingId ? 'Save changes' : 'Save draft'}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold theme-text-primary">Workspace posts</h2>
            <p className="mt-1 text-xs theme-text-muted">Workspace-scoped drafts, schedules and publishing history.</p>
          </div>
          <button type="button" onClick={() => void refreshPosts()} className="btn-ghost h-8 px-3 text-xs">Refresh</button>
        </div>
        {loading
          ? <div className="surface rounded-xl p-5 text-sm theme-text-muted">Loading drafts…</div>
          : posts.length === 0
            ? <div className="surface rounded-xl border p-6 text-center text-sm theme-text-muted">No social posts yet. Create a draft above.</div>
            : posts.map((post) => (
              <article key={post._id} className="surface rounded-xl border p-4" style={{ borderColor: 'var(--border-color)' }}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border px-2 py-1 text-[11px] font-semibold theme-text-secondary" style={{ borderColor: 'var(--border-color)' }}>{statusLabel[post.status]}</span>
                    <span className="text-xs theme-text-muted">By {post.authorId?.fullName || 'Workspace member'}</span>
                    {post.reviewerId && <span className="text-xs theme-text-muted">· Reviewed by {post.reviewerId.fullName}</span>}
                    {post.publishedAt && <span className="text-xs theme-text-muted">· {new Date(post.publishedAt).toLocaleString()}</span>}
                    {post.scheduledAt && <span className="text-xs theme-text-muted">· Scheduled {new Date(post.scheduledAt).toLocaleString()} ({post.scheduleTimeZone})</span>}
                  </div>
                  {post.status === 'published' && <span className="text-xs font-medium text-emerald-700">{post.platform} confirmed</span>}
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm theme-text-primary">{post.text}</p>
                {post.rejectionReason && <p className="mt-2 text-xs text-rose-700">Review note: {post.rejectionReason}</p>}
                {post.failureCode && <p className="mt-2 text-xs text-rose-700">Publishing needs attention: {post.failureCode.replaceAll('_', ' ')}</p>}
                {post.linkedinPostUrl && <a href={post.linkedinPostUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs font-medium text-sky-700 underline">View LinkedIn post</a>}
                {post.linkedinPostUrn && <p className="mt-2 break-all text-[11px] theme-text-muted">LinkedIn post ID: {post.linkedinPostUrn}</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  {(post.status === 'draft' || post.status === 'rejected' ||
                    (post.status === 'failed' && ['rate_limited', 'post_rejected'].includes(post.failureCode ?? ''))) && (
                    <>
                      {(post.authorId?._id === user?._id || canReview) && (
                        <button type="button" onClick={() => beginEdit(post)} className="btn-ghost h-8 px-2 text-xs">Edit draft</button>
                      )}
                      {isManager && post.authorId?._id === user?._id && (
                        <button type="button" onClick={() => void runPostAction(post, 'request-approval')} disabled={busy} className="btn-ghost h-8 px-2 text-xs">Request approval</button>
                      )}
                    </>
                  )}
                  {post.status === 'pending_approval' && canReview && (
                    <>
                      <button type="button" onClick={() => void runPostAction(post, 'review/approve')} disabled={busy} className="btn-ghost h-8 px-2 text-xs">Approve</button>
                      <button type="button" onClick={() => void runPostAction(post, 'review/reject')} disabled={busy} className="btn-ghost h-8 px-2 text-xs text-rose-700"><ThumbsDown className="mr-1 inline h-3.5 w-3.5" />Reject</button>
                    </>
                  )}
                  {canPublish(post) && (
                    <button type="button" onClick={() => void runPostAction(post, 'publish', true)} disabled={busy} className="btn-primary inline-flex h-8 items-center gap-1.5 px-2 text-xs">
                      <Send className="h-3.5 w-3.5" /> Publish now
                    </button>
                  )}
                  {(canReview || isManager) && (post.status === 'draft' || post.status === 'approved') &&
                    (canReview || post.status === 'approved') && connection?.canPublishMemberPosts && (
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="sr-only" htmlFor={`schedule-${post._id}`}>Schedule date and time</label>
                        <input
                          id={`schedule-${post._id}`}
                          type="datetime-local"
                          value={scheduleLocal}
                          onChange={(event) => setScheduleLocal(event.target.value)}
                          className="input-premium h-8 text-xs"
                          aria-label="Schedule date and time"
                        />
                        <button type="button" onClick={() => void schedulePost(post)} disabled={busy || !scheduleLocal} className="btn-ghost inline-flex h-8 items-center gap-1 px-2 text-xs disabled:opacity-50">
                          <CalendarClock className="h-3.5 w-3.5" /> Schedule
                        </button>
                      </div>
                    )}
                  {post.status === 'scheduled' && (post.authorId?._id === user?._id || canReview) && (
                    <button type="button" onClick={() => void cancelSchedule(post)} disabled={busy} className="btn-ghost inline-flex h-8 items-center gap-1 px-2 text-xs disabled:opacity-50">
                      <X className="h-3.5 w-3.5" /> Cancel schedule
                    </button>
                  )}
                  {(post.status === 'draft' || post.status === 'rejected' || post.status === 'failed') &&
                    (post.authorId?._id === user?._id || canReview) && (
                      <button type="button" onClick={() => void deleteDraft(post)} disabled={busy} className="btn-ghost inline-flex h-8 items-center gap-1 px-2 text-xs text-rose-700 disabled:opacity-50">
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </button>
                    )}
                  {post.status === 'publishing' && <span className="inline-flex items-center gap-1.5 text-xs theme-text-muted"><LoaderCircle className="h-3.5 w-3.5 animate-spin" />Do not retry while status is pending.</span>}
                </div>
              </article>
            ))}
      </section>
    </div>
  );
}
