import { expect, test, type Page, type Route } from '@playwright/test';

const entitlements = {
  crm: true, tasksProjects: true, teamChat: true, meetingsCalendar: true,
  fileStorage: true, aiAssistant: true, prioritySupport: true, advancedAnalytics: true,
};

const youtubeDraft = {
  _id: 'youtube-draft-1',
  platform: 'youtube',
  text: 'Our launch walkthrough.',
  status: 'draft',
  platformData: { title: 'Launch walkthrough', privacyStatus: 'unlisted' },
  media: [{ fileId: 'video-file-1', mimeType: 'video/mp4' }],
  authorId: { _id: 'owner-user', fullName: 'Workspace Owner' },
  createdAt: '2026-10-21T08:00:00.000Z',
  updatedAt: '2026-10-21T08:00:00.000Z',
};

type Options = { youtubeAvailable?: boolean; posts?: unknown[]; publishBodies?: unknown[] };

async function mockSocialPublishing(page: Page, options: Options = {}) {
  const youtubeAvailable = options.youtubeAvailable ?? true;
  await page.addInitScript(() => {
    sessionStorage.setItem('workgrind_access_token', 'playwright-social-access');
    sessionStorage.setItem('workgrind_refresh_token', 'playwright-social-refresh');
  });
  await page.route('**/api/**', async (route: Route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    const headers = {
      'access-control-allow-origin': request.headers().origin ?? 'http://127.0.0.1:3101',
      'access-control-allow-credentials': 'true',
      'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      'access-control-allow-headers': 'Authorization,Content-Type,Cache-Control',
    };
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, headers, contentType: 'application/json', body: JSON.stringify(body) });
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });

    if (pathname.endsWith('/auth/me')) {
      return json({
        success: true,
        user: {
          _id: 'owner-user', fullName: 'Workspace Owner', email: 'owner@example.invalid', role: 'owner',
          companyId: { _id: 'company-1', name: 'Social Workspace', organizationType: 'business', accountType: 'company' },
          theme: 'light', preferredLanguage: 'en',
        },
      });
    }
    if (pathname.endsWith('/auth/refresh')) return json({ success: true, accessToken: 'playwright-social-access' });
    if (pathname.endsWith('/subscription/status')) {
      return json({
        success: true,
        source: 'company',
        subscription: {
          status: 'active', plan: 'pro', planName: 'Pro', priceDisplay: '$19/mo', organizationType: 'business',
          hasActiveAccess: true, trialDaysRemaining: null, cancelAtPeriodEnd: false, entitlements,
          limits: { members: -1, storage: 0, aiRequests: -1 },
          usage: { members: 1, pendingInvites: 0, memberSlotsUsed: 1, storageBytes: 0, aiRequests: 0, aiRequestsByUser: 0 },
        },
      });
    }
    if (pathname.endsWith('/social-publishing/providers')) {
      const capabilities = (on: boolean) => ({ connect: on, publishText: false, publishMedia: on, schedule: false, analytics: false, organizationPublishing: false });
      return json({
        success: true,
        providers: [
          { id: 'linkedin', name: 'LinkedIn', availability: 'available', capabilities: { ...capabilities(true), publishText: true, schedule: true } },
          { id: 'youtube', name: 'YouTube', availability: youtubeAvailable ? 'available' : 'setup_required', capabilities: capabilities(youtubeAvailable) },
        ],
      });
    }
    if (pathname.endsWith('/social-publishing/accounts')) {
      return json({
        success: true,
        accounts: youtubeAvailable
          ? [{ id: 'youtube-integration', provider: 'youtube', status: 'connected', displayName: 'WorkGrind Studio', displayEmail: null, expiresAt: null, canPublish: true }]
          : [],
      });
    }
    if (pathname.endsWith('/social-publishing/youtube/connection')) {
      return json({
        success: true,
        connection: {
          configured: youtubeAvailable,
          connected: youtubeAvailable,
          status: youtubeAvailable ? 'connected' : 'disconnected',
          channelTitle: youtubeAvailable ? 'WorkGrind Studio' : null,
          channelId: youtubeAvailable ? 'UC-test' : null,
          identityEmail: null,
          scopes: [],
          canPublishVideos: youtubeAvailable,
          errorCode: null,
        },
      });
    }
    if (pathname.endsWith('/social-publishing/connection')) {
      return json({
        success: true,
        connection: { connected: false, status: 'disconnected', identityName: null, identityEmail: null, scopes: [], canPublishMemberPosts: false, expiresAt: null, errorCode: null },
      });
    }
    if (pathname.includes('/social-publishing/media/')) {
      return route.fulfill({ status: 404, headers, contentType: 'application/json', body: '{}' });
    }
    if (pathname.endsWith('/social-publishing/posts') && request.method() === 'GET') {
      return json({ success: true, posts: options.posts ?? [] });
    }
    if (/\/social-publishing\/posts\/[^/]+\/publish$/.test(pathname)) {
      options.publishBodies?.push(request.postDataJSON());
      return json({
        success: true,
        post: { ...youtubeDraft, status: 'published', destinations: [{ provider: 'youtube', status: 'published', externalPostUrl: 'https://www.youtube.com/watch?v=abcDEF12345' }] },
      });
    }
    return json({ success: true });
  });
}

test('YouTube is selectable with title, visibility, and video-only upload when configured', async ({ page }) => {
  await mockSocialPublishing(page);
  await page.goto('/social-publishing');

  const youtubeTile = page.getByRole('button', { name: /Upload videos with a title and description/ });
  await expect(youtubeTile).toBeEnabled();
  await expect(youtubeTile).toContainText('Available');
  await youtubeTile.click();

  await expect(page.getByRole('heading', { name: 'Upload a YouTube video' })).toBeVisible();
  await expect(page.getByLabel('Video title')).toBeVisible();
  await expect(page.getByLabel('Visibility')).toHaveValue('private');
  await expect(page.getByText('Video description')).toBeVisible();
  await expect(page.getByRole('button', { name: /Generate with Tavro/ })).toHaveCount(0);
  await expect(page.locator('input[type="file"]')).toHaveAttribute('accept', 'video/mp4,video/webm');
  await expect(page.getByRole('button', { name: 'Upload to YouTube' })).toBeVisible();
  await expect(page.getByText('WorkGrind Studio').first()).toBeVisible();
});

test('YouTube shows Setup required and stays disabled when Google OAuth is not configured', async ({ page }) => {
  await mockSocialPublishing(page, { youtubeAvailable: false });
  await page.goto('/social-publishing');

  const youtubeTile = page.getByRole('button', { name: /Upload videos with a title and description/ });
  await expect(youtubeTile).toContainText('Setup required');
  await expect(youtubeTile).toBeDisabled();
  await expect(page.getByText(/YouTube setup required/)).toBeVisible();
});

test('the YouTube consent redirect is reported by the YouTube card, not the LinkedIn card', async ({ page }) => {
  await mockSocialPublishing(page);
  await page.goto('/social-publishing?oauth=connected&oauth_provider=youtube');

  await expect(page.getByText('YouTube channel connected.')).toBeVisible();
  await expect(page.getByText(/LinkedIn publishing (permission )?connected/)).toHaveCount(0);
  await expect.poll(() => new URL(page.url()).search).toBe('');
});

test('publishing a YouTube draft sends the YouTube platform and shows the watch link', async ({ page }) => {
  const publishBodies: unknown[] = [];
  await mockSocialPublishing(page, { posts: [youtubeDraft], publishBodies });
  await page.goto('/social-publishing');

  await expect(page.getByText('Launch walkthrough').first()).toBeVisible();
  page.once('dialog', (dialog) => void dialog.accept());
  await page.getByRole('button', { name: 'Publish now', exact: true }).click();

  await expect.poll(() => publishBodies).toEqual([{ platform: 'youtube' }]);
  await expect(page.getByText('Published: https://www.youtube.com/watch?v=abcDEF12345')).toBeVisible();
});
