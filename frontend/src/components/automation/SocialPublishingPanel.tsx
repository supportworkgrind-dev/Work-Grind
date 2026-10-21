'use client';

import Image from 'next/image';
import { useEffect, useState, type ChangeEvent } from 'react';
import { CalendarClock, Camera, Check, Eye, ImagePlus, LoaderCircle, Pencil, Play, Plus, Send, Sparkles, ThumbsDown, Trash2, Video, X } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';
import { LinkedInConnection, LinkedInConnectionCard } from './LinkedInConnectionCard';
import { YouTubeConnection, YouTubeConnectionCard } from './YouTubeConnectionCard';

type SocialPost = {
  _id: string;
  platform: 'linkedin' | 'instagram' | 'facebook' | 'youtube';
  integrationId?: string;
  text: string;
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'scheduled' | 'publishing' | 'published' | 'failed';
  authorId?: { _id: string; fullName: string };
  reviewerId?: { _id: string; fullName: string };
  rejectionReason?: string;
  linkedinPostUrn?: string;
  linkedinPostUrl?: string;
  failureCode?: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  scheduledAt?: string;
  scheduleTimeZone?: string;
  media?: SocialMedia[];
  platformData?: { title?: string; privacyStatus?: YouTubePrivacy; youtubeVideoId?: string };
  destinations?: Array<{ provider: string; status: string; externalPostId?: string; externalPostUrl?: string }>;
};

type YouTubePrivacy = 'private' | 'unlisted' | 'public';

const PROVIDER_NAMES: Record<SocialPost['platform'], string> = {
  linkedin: 'LinkedIn',
  instagram: 'Instagram',
  facebook: 'Facebook',
  youtube: 'YouTube',
};

const YOUTUBE_VIDEO_TYPES = ['video/mp4', 'video/webm'];
const isVideoType = (mimeType: string) => mimeType.startsWith('video/');

function failureMessage(post: SocialPost): string {
  const provider = PROVIDER_NAMES[post.platform];
  const messages: Record<string, string> = {
    authorization_revoked: `Reconnect ${provider} and try again.`,
    permission_or_member_access_denied: `${provider} permission is unavailable. Reconnect the publishing account.`,
    rate_limited: `${provider} is rate limiting requests. Retry after a short wait.`,
    quota_exceeded: 'The YouTube upload quota is exhausted. Retry after it resets.',
    post_rejected: `${provider} rejected this post. Edit the draft before retrying.`,
    media_unavailable: 'The attached media is no longer available. Replace the attachment and retry.',
    provider_timeout: `${provider} did not respond in time. Check the post status before trying again.`,
    provider_unavailable: `${provider} could not confirm publication. Check the post status before taking further action.`,
  };
  return messages[post.failureCode ?? ''] || 'Review the post and connection before retrying.';
}

function publishedUrl(post: SocialPost): string | undefined {
  return post.platform === 'youtube'
    ? post.destinations?.find((destination) => destination.provider === 'youtube')?.externalPostUrl
    : post.linkedinPostUrl;
}

type SocialMedia = {
  fileId: string | { _id: string; name?: string; mimeType?: string; size?: number };
  mimeType: string;
  altText?: string;
  name?: string;
  size?: number;
};

function socialMediaFileId(media: SocialMedia | undefined): string | undefined {
  if (!media) return undefined;
  return typeof media.fileId === 'string' ? media.fileId : media.fileId?._id;
}

type SocialProvider = {
  id: 'linkedin' | 'instagram' | 'facebook' | 'youtube';
  name: string;
  availability: 'available' | 'setup_required' | 'coming_soon';
  capabilities: { connect: boolean; publishText: boolean; publishMedia: boolean; schedule: boolean; analytics: boolean; organizationPublishing: boolean };
};

type SocialAccount = {
  id: string;
  provider: SocialProvider['id'];
  status: 'connected' | 'disconnected' | 'error' | 'pending';
  displayName: string | null;
  displayEmail: string | null;
  expiresAt: string | null;
  canPublish: boolean;
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
  const [youtubeConnection, setYouTubeConnection] = useState<YouTubeConnection | null>(null);
  const [videoTitle, setVideoTitle] = useState('');
  const [privacyStatus, setPrivacyStatus] = useState<YouTubePrivacy>('private');
  const [providers, setProviders] = useState<SocialProvider[]>([]);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [composerMedia, setComposerMedia] = useState<SocialMedia | null>(null);
  const [mediaPreviews, setMediaPreviews] = useState<Record<string, string>>({});
  const [uploadProgress, setUploadProgress] = useState(0);
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
      api.get('/social-publishing/accounts'),
    ])
      .then(([postsResponse, providersResponse, accountsResponse]) => {
        if (!active) return;
        setPosts(postsResponse.data.posts as SocialPost[]);
        setProviders(providersResponse.data.providers as SocialProvider[]);
        const nextAccounts = accountsResponse.data.accounts as SocialAccount[];
        setAccounts(nextAccounts);
        setSelectedAccountId(nextAccounts.find((account) => account.canPublish)?.id ?? '');
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

  useEffect(() => {
    let active = true;
    const ids = [...new Set([
      ...posts.flatMap((post) => post.media ?? []).map(socialMediaFileId),
      socialMediaFileId(composerMedia ?? undefined),
    ].filter((id): id is string => Boolean(id)))];
    const objectUrls: string[] = [];
    void Promise.all(ids.map(async (id) => {
      try {
        const response = await api.get(`/social-publishing/media/${id}`, { responseType: 'blob' });
        const url = URL.createObjectURL(response.data as Blob);
        objectUrls.push(url);
        return [id, url] as const;
      } catch {
        return [id, ''] as const;
      }
    })).then((entries) => {
      if (active) setMediaPreviews(Object.fromEntries(entries.filter(([, url]) => url)));
    });
    return () => {
      active = false;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [composerMedia, posts]);

  const isYouTube = selectedPlatform === 'youtube';
  const youtubeAvailable = providers.find((provider) => provider.id === 'youtube')?.availability === 'available';
  const destinationConnected = isYouTube
    ? Boolean(youtubeConnection?.canPublishVideos)
    : Boolean(connection?.canPublishMemberPosts);

  /** Mirrors backend validation so errors appear before any request is sent. */
  const composerError = (): string | null => {
    if (!text.trim() || text.trim().length > 3000) {
      return isYouTube ? 'Enter a video description between 1 and 3000 characters.' : 'Enter post text between 1 and 3000 characters.';
    }
    if (!isYouTube) return null;
    if (!videoTitle.trim() || videoTitle.trim().length > 100) return 'Enter a video title between 1 and 100 characters.';
    if (/[<>]/.test(videoTitle) || /[<>]/.test(text)) return 'YouTube titles and descriptions cannot contain < or > characters.';
    if (!composerMedia || !YOUTUBE_VIDEO_TYPES.includes(composerMedia.mimeType)) return 'Attach one MP4 or WebM video for YouTube.';
    return null;
  };

  const composerPayload = () => ({
    text: text.trim(),
    media: composerMedia ? [{
      fileId: socialMediaFileId(composerMedia),
      mimeType: composerMedia.mimeType,
      ...(composerMedia.altText ? { altText: composerMedia.altText } : {}),
    }] : [],
    ...(isYouTube ? { platformData: { title: videoTitle.trim(), privacyStatus } } : {}),
  });

  const resetComposer = () => {
    setText('');
    setVideoTitle('');
    setPrivacyStatus('private');
    setComposerMedia(null);
    setEditingId(null);
    setPreview(false);
  };

  const saveDraft = async () => {
    const validationError = composerError();
    if (validationError) {
      setError(validationError);
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const payload = composerPayload();
      if (editingId) await api.patch(`/social-publishing/posts/${editingId}`, payload);
      else await api.post('/social-publishing/posts', {
        ...payload,
        platform: selectedPlatform,
        ...(accounts.find((account) => account.id === selectedAccountId && account.canPublish)
          ? { integrationId: selectedAccountId }
          : {}),
      });
      await refreshPosts();
      resetComposer();
      setNotice('Draft saved.');
    } catch (requestError: unknown) {
      const message = (requestError as { response?: { data?: { message?: string } } }).response?.data?.message;
      setError(message || 'The draft could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  const publishCurrentNow = async () => {
    const providerName = PROVIDER_NAMES[selectedPlatform];
    if (!destinationConnected) {
      setError(`Connect ${providerName} publishing before publishing this post.`);
      return;
    }
    const validationError = composerError();
    if (validationError) {
      setError(validationError);
      return;
    }
    if (isYouTube && !window.confirm(`Upload this video to ${youtubeConnection?.channelTitle || 'the connected YouTube channel'} as ${privacyStatus}?`)) return;
    setBusy(true);
    setError('');
    setNotice(isYouTube ? 'Uploading to YouTube. Keep this page open; large videos can take a few minutes.' : '');
    try {
      const accountId = accounts.find((account) => account.id === selectedAccountId && account.provider === selectedPlatform)?.id;
      const payload = {
        ...composerPayload(),
        platform: selectedPlatform,
        ...(accountId ? { integrationId: accountId } : {}),
      };
      let postId = editingId;
      if (postId) {
        await api.patch(`/social-publishing/posts/${postId}`, payload);
      } else {
        const created = await api.post('/social-publishing/posts', payload);
        postId = created.data.post?._id;
      }
      if (!postId) throw new Error('The draft could not be saved before publishing.');
      const result = await api.post(`/social-publishing/posts/${postId}/publish`, {
        platform: selectedPlatform,
        ...(accountId ? { integrationId: accountId } : {}),
      }, isYouTube ? { timeout: 5 * 60_000 } : undefined);
      await refreshPosts();
      resetComposer();
      const url = isYouTube
        ? result.data.post?.destinations?.[0]?.externalPostUrl
        : result.data.post?.linkedinPostUrl;
      setNotice(isYouTube
        ? `YouTube accepted the upload${url ? `: ${url}` : ''}. Processing may take a few minutes.`
        : url ? `LinkedIn confirmed publication: ${url}` : 'LinkedIn confirmed publication.');
    } catch (requestError: unknown) {
      const message = (requestError as { response?: { data?: { message?: string } } }).response?.data?.message;
      setNotice('');
      setError(message || (requestError instanceof Error ? requestError.message : `${providerName} could not confirm publication.`));
      await refreshPosts().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  };

  const uploadMedia = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (composerMedia) {
      setError('Remove the current attachment before choosing another file.');
      return;
    }
    const allowed = isYouTube
      ? YOUTUBE_VIDEO_TYPES.includes(file.type)
      : file.type === 'image/jpeg' || file.type === 'image/png' || file.type === 'video/mp4';
    const maxBytes = file.type.startsWith('image/') ? 36 * 1024 * 1024 : 50 * 1024 * 1024;
    if (!allowed || file.size <= 0 || file.size > maxBytes) {
      setError(isYouTube
        ? 'Choose one MP4 or WebM video up to 50 MB.'
        : 'Choose one JPEG or PNG image (up to 36 MB) or MP4 video (up to 50 MB).');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      setUploadProgress(0);
      const response = await api.post('/files/upload', formData, {
        onUploadProgress: (event) => {
          if (event.total) setUploadProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
        },
      });
      const storedFile = response.data.file;
      setComposerMedia({
        fileId: storedFile._id,
        mimeType: storedFile.mimeType,
        name: storedFile.originalName,
        size: storedFile.size,
      });
      setNotice('Media uploaded to your workspace and attached to this draft.');
    } catch (requestError: unknown) {
      const message = (requestError as { response?: { data?: { message?: string } } }).response?.data?.message;
      setError(message || 'The media file could not be uploaded.');
    } finally {
      setBusy(false);
      setUploadProgress(0);
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
    const youtubePost = post.platform === 'youtube';
    if (confirmPublish && !window.confirm(youtubePost
      ? `Upload "${post.platformData?.title || 'this video'}" to ${youtubeConnection?.channelTitle || 'the connected YouTube channel'} as ${post.platformData?.privacyStatus || 'private'}?`
      : 'Publish this text post to the connected LinkedIn member profile now?')) return;
    setBusy(true);
    setError('');
    setNotice(action === 'publish' && youtubePost ? 'Uploading to YouTube. Keep this page open; large videos can take a few minutes.' : '');
    try {
      const response = await api.post(`/social-publishing/posts/${post._id}/${action}`, {
        ...(action === 'publish' ? { platform: post.platform } : {}),
        ...(post.integrationId ? { integrationId: post.integrationId } : {}),
      }, action === 'publish' && youtubePost ? { timeout: 5 * 60_000 } : undefined);
      await refreshPosts();
      setNotice(action === 'publish'
        ? youtubePost ? 'YouTube accepted the upload. Processing may take a few minutes.' : 'LinkedIn confirmed the post was published.'
        : action === 'request-approval'
          ? 'Draft submitted for approval.'
          : `Post ${action === 'approve' ? 'approved' : 'rejected'}.`);
      const url = youtubePost ? response.data.post?.destinations?.[0]?.externalPostUrl : response.data.post?.linkedinPostUrl;
      if (url) setNotice(`Published: ${url}`);
    } catch (requestError: unknown) {
      const message = (requestError as { response?: { data?: { message?: string } } }).response?.data?.message;
      setNotice('');
      setError(message || 'That action could not be completed.');
      await refreshPosts().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  };

  const beginEdit = (post: SocialPost) => {
    setEditingId(post._id);
    setSelectedPlatform(post.platform);
    setVideoTitle(post.platformData?.title ?? '');
    setPrivacyStatus(post.platformData?.privacyStatus ?? 'private');
    setText(post.text);
    setComposerMedia(post.media?.[0] ?? null);
    setPreview(false);
    setError('');
    setNotice('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const canPublish = (post: SocialPost) => (post.platform === 'youtube'
    ? youtubeConnection?.canPublishVideos
    : connection?.canPublishMemberPosts) &&
    (canReview
      ? post.status === 'draft' || post.status === 'approved' ||
        (post.status === 'failed' && (post.failureCode === 'rate_limited' || (post.platform === 'youtube' && post.failureCode === 'quota_exceeded')))
      : isManager && post.status === 'approved');

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <button type="button" onClick={() => document.getElementById('social-post-composer')?.scrollIntoView({ behavior: 'smooth' })} className="btn-primary inline-flex min-h-10 items-center gap-2 px-4 text-sm font-semibold">
          <Plus className="h-4 w-4" />Create Post
        </button>
      </div>
      <LinkedInConnectionCard
        onConnectionChange={setConnection}
        returnTo="/social-publishing"
        canDisconnect={canReview}
      />
      <YouTubeConnectionCard
        onConnectionChange={setYouTubeConnection}
        returnTo="/social-publishing"
        canDisconnect={canReview}
        canConnect={canReview || isManager}
      />

      <section className="surface rounded-2xl border p-4 sm:p-5" aria-labelledby="social-providers-heading">
        <h2 id="social-providers-heading" className="text-sm font-semibold theme-text-primary">Publishing destinations</h2>
        <p className="mt-1 text-xs theme-text-muted">Publish posts to your LinkedIn member profile and upload videos to your YouTube channel.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { id: 'linkedin' as const, name: 'LinkedIn', description: 'Publish text, images, and videos to a member profile.', icon: <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#0A66C2] text-sm font-bold text-white">in</span>, available: true, accent: '#0A66C2' },
            { id: 'instagram' as const, name: 'Instagram', description: 'Visual content and Reels publishing.', icon: <Camera className="h-5 w-5 text-fuchsia-600" />, available: false, accent: '#C13584' },
            { id: 'facebook' as const, name: 'Facebook Pages', description: 'Publish and manage content for your Pages.', icon: <span className="flex h-6 w-6 items-end justify-center text-2xl font-black leading-none text-blue-700">f</span>, available: false, accent: '#1877F2' },
            { id: 'youtube' as const, name: 'YouTube', description: 'Upload videos with a title and description to your channel.', icon: <span className="flex h-5 w-7 items-center justify-center rounded bg-red-600 text-white"><Play className="h-3 w-3 fill-current" /></span>, available: youtubeAvailable, setupRequired: !youtubeAvailable, accent: '#FF0000' },
          ].map((destination) => (
            <button
              key={destination.id}
              type="button"
              disabled={!destination.available || Boolean(editingId)}
              aria-pressed={selectedPlatform === destination.id}
              onClick={() => {
                if (destination.id !== selectedPlatform) {
                  setSelectedPlatform(destination.id);
                  setComposerMedia(null);
                  setPreview(false);
                  setError('');
                }
              }}
              className={`rounded-xl border p-3 text-left transition-colors ${selectedPlatform === destination.id ? 'border-[var(--accent)] bg-[var(--bg-active)]' : 'theme-border theme-bg-base'} disabled:cursor-default`}
              style={{ borderTopColor: destination.accent, borderTopWidth: 2 }}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm font-semibold theme-text-primary">{destination.icon}{destination.name}</span>
                <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${destination.available ? 'bg-emerald-500/10 text-emerald-700' : 'theme-bg-hover theme-text-muted'}`}>
                  {destination.available ? 'Available' : 'setupRequired' in destination && destination.setupRequired ? 'Setup required' : 'Coming Soon'}
                </span>
              </span>
              <span className="mt-2 block text-xs leading-relaxed theme-text-muted">{destination.description}</span>
            </button>
          ))}
        </div>
      </section>

      <section id="social-post-composer" className="surface rounded-2xl border p-4 sm:p-5">
        <div className="mb-4">
          <h2 className="text-base font-semibold theme-text-primary">
            {editingId ? 'Edit post draft' : isYouTube ? 'Upload a YouTube video' : 'Create a LinkedIn post'}
          </h2>
          <p className="mt-1 text-xs theme-text-muted">
            {isYouTube
              ? 'Save as a draft or upload to the connected YouTube channel. Videos are private by default.'
              : 'Save as a draft or publish to the connected LinkedIn member profile. Tavro only writes draft text; it never publishes.'}
          </p>
        </div>

        <div className="mb-3 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-medium theme-text-secondary">
            Destination account
            <select
              value={selectedAccountId}
              onChange={(event) => setSelectedAccountId(event.target.value)}
              className="input-premium mt-1 w-full"
              aria-label="Select a connected social account"
            >
              <option value="">Save as draft without a connected account</option>
              {accounts.filter((account) => account.provider === selectedPlatform).map((account) => (
                <option key={account.id} value={account.id}>
                  {account.displayName || (account.provider === 'youtube' ? 'YouTube channel' : 'LinkedIn member')} {account.canPublish ? '· Connected' : '· Reconnect required'}
                </option>
              ))}
            </select>
          </label>
          <p className="self-end text-xs theme-text-muted">
            {accounts.some((account) => account.provider === selectedPlatform && account.canPublish)
              ? 'Publishing uses this workspace-authorized account.'
              : 'Connect an authorized account before publishing.'}
          </p>
        </div>

        {error && <p role="alert" className="mb-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        {notice && <p role="status" className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</p>}

        {isYouTube ? (
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_190px]">
            <label className="text-xs font-medium theme-text-secondary">
              Video title
              <input value={videoTitle} onChange={(event) => setVideoTitle(event.target.value)} maxLength={100} placeholder="What is this video called?" className="input-premium mt-1 w-full" />
              <span className={`mt-1 block text-[11px] ${videoTitle.length > 100 ? 'text-rose-600' : 'theme-text-muted'}`}>{videoTitle.length}/100</span>
            </label>
            <label className="text-xs font-medium theme-text-secondary">
              Visibility
              <select value={privacyStatus} onChange={(event) => setPrivacyStatus(event.target.value as YouTubePrivacy)} className="input-premium mt-1 w-full">
                <option value="private">Private</option>
                <option value="unlisted">Unlisted</option>
                <option value="public">Public</option>
              </select>
            </label>
          </div>
        ) : (<>
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
        </>)}

        <div className="mt-4 border-t pt-4" style={{ borderColor: 'var(--border-color)' }}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <label htmlFor="linkedin-post-text" className="text-xs font-semibold theme-text-secondary">{isYouTube ? 'Video description' : 'Post text'}</label>
            <button type="button" onClick={() => setPreview(!preview)} className="btn-ghost inline-flex h-8 items-center gap-1.5 px-2 text-xs">
              {preview ? <Pencil className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {preview ? 'Edit' : 'Preview'}
            </button>
          </div>
          {preview
            ? <div className="min-h-32 rounded-xl border p-4" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-base)' }}>
                {isYouTube
                  ? <div className="mb-3 flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-md bg-red-600 text-white"><Play className="h-4 w-4 fill-current" /></span><div><p className="text-xs font-semibold theme-text-primary">{videoTitle || 'Untitled video'}</p><p className="text-[10px] theme-text-muted">{youtubeConnection?.channelTitle || 'Your YouTube channel'} · {privacyStatus}</p></div></div>
                  : <div className="mb-3 flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#0A66C2] text-sm font-bold text-white">in</span><div><p className="text-xs font-semibold theme-text-primary">{connection?.identityName || 'Your LinkedIn profile'}</p><p className="text-[10px] theme-text-muted">Just now · Public</p></div></div>}
                <p className="whitespace-pre-wrap text-sm theme-text-primary">{text || 'Your post preview will appear here.'}</p>
                {composerMedia && socialMediaFileId(composerMedia) && mediaPreviews[socialMediaFileId(composerMedia)!] && (
                  <div className="mt-3 overflow-hidden rounded-lg border theme-border">
                    {isVideoType(composerMedia.mimeType)
                      ? <video controls preload="metadata" src={mediaPreviews[socialMediaFileId(composerMedia)!]} className="max-h-80 w-full bg-black" />
                      : <Image unoptimized width={640} height={480} src={mediaPreviews[socialMediaFileId(composerMedia)!]} alt={composerMedia.altText || composerMedia.name || 'Post attachment'} className="max-h-80 w-full object-contain" />}
                  </div>
                )}
              </div>
            : <textarea id="linkedin-post-text" value={text} onChange={(event) => setText(event.target.value)} maxLength={3000} rows={6} placeholder={isYouTube ? 'Describe the video for viewers.' : 'Write a post or generate a draft with Tavro.'} className="input-premium w-full resize-y" />}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label className={`btn-ghost inline-flex h-9 cursor-pointer items-center gap-2 px-3 text-xs ${busy || composerMedia ? 'pointer-events-none opacity-50' : ''}`}>
              {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
              {isYouTube ? 'Choose video' : 'Add image or video'}
              <input type="file" accept={isYouTube ? 'video/mp4,video/webm' : 'image/jpeg,image/png,video/mp4'} onChange={(event) => void uploadMedia(event)} disabled={busy || Boolean(composerMedia)} className="sr-only" />
            </label>
            <span className="text-[11px] theme-text-muted">{isYouTube ? 'One MP4 or WebM video up to 50 MB' : 'JPEG/PNG up to 36 MB · MP4 up to 50 MB'}</span>
          </div>
          {busy && uploadProgress > 0 && <div className="mt-2" aria-live="polite"><div className="h-1.5 overflow-hidden rounded-full bg-black/10"><div className="h-full bg-[var(--accent)] transition-[width]" style={{ width: `${uploadProgress}%` }} /></div><p className="mt-1 text-[11px] theme-text-muted">Uploading media · {uploadProgress}%</p></div>}
          {composerMedia && <div className="mt-3 flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-base)' }}>
            <div className="flex h-20 w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-black/5">
              {mediaPreviews[socialMediaFileId(composerMedia)!]
                ? isVideoType(composerMedia.mimeType)
                  ? <video src={mediaPreviews[socialMediaFileId(composerMedia)!]} className="h-full w-full object-cover" />
                  : <Image unoptimized width={224} height={160} src={mediaPreviews[socialMediaFileId(composerMedia)!]} alt={composerMedia.altText || composerMedia.name || 'Selected post attachment'} className="h-full w-full object-cover" />
                : isVideoType(composerMedia.mimeType) ? <Video className="h-6 w-6 theme-text-muted" /> : <ImagePlus className="h-6 w-6 theme-text-muted" />}
            </div>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium theme-text-primary">{composerMedia.name || (isYouTube ? 'YouTube video' : 'LinkedIn media attachment')}</p><p className="text-xs theme-text-muted">{composerMedia.mimeType} · {composerMedia.size ? `${(composerMedia.size / 1024 / 1024).toFixed(1)} MB` : 'Ready to publish'}</p></div>
            <button type="button" onClick={() => setComposerMedia(null)} className="btn-ghost inline-flex h-9 items-center gap-1.5 px-3 text-xs text-rose-700"><X className="h-4 w-4" />Remove</button>
          </div>}
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <span className={`text-xs ${text.length > 3000 ? 'text-rose-600' : 'theme-text-muted'}`}>{text.length}/3000</span>
            <div className="flex gap-2">
              {editingId && <button type="button" onClick={() => { setEditingId(null); setText(''); }} className="btn-ghost h-9 px-3 text-xs">Cancel edit</button>}
              <button type="button" onClick={() => void saveDraft()} disabled={busy || !text.trim()} className="btn-primary inline-flex h-9 items-center gap-2 px-3 text-xs disabled:opacity-50">
                {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {editingId ? 'Save changes' : 'Save draft'}
              </button>
              {canReview && <button type="button" onClick={() => void publishCurrentNow()} disabled={busy || !text.trim() || !destinationConnected} className="btn-primary inline-flex h-9 items-center gap-2 px-3 text-xs disabled:opacity-50">
                {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {isYouTube ? 'Upload to YouTube' : 'Publish Now'}
              </button>}
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
                    <span className="text-xs theme-text-muted">· Created {new Date(post.createdAt).toLocaleString()}</span>
                    {post.publishedAt && <span className="text-xs theme-text-muted">· {new Date(post.publishedAt).toLocaleString()}</span>}
                    {post.scheduledAt && <span className="text-xs theme-text-muted">· Scheduled {new Date(post.scheduledAt).toLocaleString()} ({post.scheduleTimeZone})</span>}
                  </div>
                  <span className="flex items-center gap-2">
                    <span className="rounded-full px-2 py-1 text-[10px] font-semibold theme-bg-hover theme-text-secondary">{PROVIDER_NAMES[post.platform]}</span>
                    {post.status === 'published' && <span className="text-xs font-medium text-emerald-700">{PROVIDER_NAMES[post.platform]} confirmed</span>}
                  </span>
                </div>
                {post.platform === 'youtube' && post.platformData?.title && (
                  <p className="mt-3 text-sm font-semibold theme-text-primary">
                    {post.platformData.title}
                    <span className="ml-2 text-[11px] font-normal theme-text-muted">{post.platformData.privacyStatus || 'private'}</span>
                  </p>
                )}
                <p className={`${post.platform === 'youtube' ? 'mt-1' : 'mt-3'} whitespace-pre-wrap text-sm theme-text-primary`}>{post.text}</p>
                {post.media?.map((media) => {
                  const fileId = socialMediaFileId(media);
                  const src = fileId ? mediaPreviews[fileId] : '';
                  if (!src) return null;
                  return <div key={fileId} className="mt-3 max-w-xl overflow-hidden rounded-xl border theme-border">
                    {isVideoType(media.mimeType)
                      ? <video controls preload="metadata" src={src} className="max-h-96 w-full bg-black" />
                      : <Image unoptimized width={640} height={480} src={src} alt={media.altText || (typeof media.fileId === 'object' ? media.fileId.name : undefined) || 'LinkedIn post attachment'} className="max-h-96 w-full object-contain" />}
                  </div>;
                })}
                {post.rejectionReason && <p className="mt-2 text-xs text-rose-700">Review note: {post.rejectionReason}</p>}
                {post.failureCode && <p className="mt-2 text-xs text-rose-700">Publishing needs attention: {failureMessage(post)}</p>}
                {publishedUrl(post) && <a href={publishedUrl(post)} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs font-medium text-sky-700 underline">View {PROVIDER_NAMES[post.platform]} {post.platform === 'youtube' ? 'video' : 'post'}</a>}
                {post.status === 'published' && !publishedUrl(post) && <p className="mt-2 text-xs theme-text-muted">{PROVIDER_NAMES[post.platform]} confirmed publication; a permalink was not provided.</p>}
                {post.status === 'published' && post.platform === 'youtube' && <p className="mt-1 text-[11px] theme-text-muted">YouTube may take a few minutes to finish processing the video.</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  {(post.status === 'draft' || post.status === 'rejected' ||
                    (post.status === 'failed' && ['rate_limited', 'post_rejected', 'media_unavailable'].includes(post.failureCode ?? ''))) && (
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
                      <Send className="h-3.5 w-3.5" /> {post.status === 'failed' ? 'Retry publish' : 'Publish now'}
                    </button>
                  )}
                  {post.platform === 'linkedin' && (canReview || isManager) && (post.status === 'draft' || post.status === 'approved') &&
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
