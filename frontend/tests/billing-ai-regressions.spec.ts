import { expect, test, type Route } from '@playwright/test';

const conversationId = 'regression-conversation-001';

const subscription = {
  status: 'active',
  plan: 'pro',
  planName: 'Pro',
  priceDisplay: '$29/month',
  hasActiveAccess: true,
  trialDaysRemaining: null,
  cancelAtPeriodEnd: false,
  entitlements: {
    crm: true,
    tasksProjects: true,
    teamChat: true,
    meetingsCalendar: true,
    fileStorage: true,
    aiAssistant: true,
    prioritySupport: true,
    advancedAnalytics: true,
  },
  limits: { members: 25, storage: 10_000_000_000, aiRequests: 500 },
  usage: {
    members: 1,
    pendingInvites: 0,
    memberSlotsUsed: 1,
    storageBytes: 0,
    aiRequests: 1,
    aiRequestsByUser: 1,
  },
};

const plans = ['free', 'starter', 'pro'].map((id, index) => ({
  id,
  name: id[0].toUpperCase() + id.slice(1),
  priceMonthly: index * 2900,
  priceDisplay: index ? `$${index * 29}/month` : 'Free',
  description: 'Regression test plan',
  highlighted: id === 'pro',
  entitlements: subscription.entitlements,
  limits: subscription.limits,
  features: [{ label: 'Workspace tools', included: true }],
}));

type AgentMessage = { role: 'user' | 'assistant'; content: string; createdAt: string };

function setSessionAuth(page: import('@playwright/test').Page) {
  return page.addInitScript(() => {
    sessionStorage.setItem('workgrind_access_token', 'playwright-regression-access');
    sessionStorage.setItem('workgrind_refresh_token', 'playwright-regression-refresh');
  });
}

async function mockApi(
  route: Route,
  options: {
    messages: AgentMessage[];
    subscriptionRequests: number[];
    planRequests: number[];
    agentRequests: Array<{ conversationId?: string; history?: AgentMessage[]; message?: string }>;
    failFirstAgentRequest?: boolean;
    failSubscriptionRequestAt?: number;
    noSubscriptionRecord?: boolean;
    expireCurrentUserOnce?: { value: boolean };
  }
) {
  const request = route.request();
  const url = new URL(request.url());
  const pathname = url.pathname;
  const origin = request.headers().origin ?? 'http://127.0.0.1:3101';
  const headers = {
    'access-control-allow-origin': origin,
    'access-control-allow-credentials': 'true',
    'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'access-control-allow-headers': 'Authorization,Content-Type,Cache-Control',
  };

  if (request.method() === 'OPTIONS') {
    await route.fulfill({ status: 204, headers });
    return;
  }
  if (pathname.endsWith('/auth/me')) {
    if (options.expireCurrentUserOnce && !options.expireCurrentUserOnce.value) {
      options.expireCurrentUserOnce.value = true;
      await route.fulfill({
        status: 401,
        headers,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, message: 'Invalid or expired token' }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      headers,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        user: {
          _id: 'playwright-user',
          fullName: 'Regression User',
          email: 'regression@example.invalid',
          role: 'owner',
          companyId: { _id: 'playwright-company', name: 'Regression Workspace' },
          theme: 'light',
          preferredLanguage: 'en',
        },
      }),
    });
    return;
  }
  if (pathname.endsWith('/auth/refresh')) {
    await route.fulfill({
      status: 200,
      headers,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, accessToken: 'playwright-refreshed-access' }),
    });
    return;
  }
  if (pathname.endsWith('/subscription/status')) {
    options.subscriptionRequests.push(Date.now());
    if (options.failSubscriptionRequestAt === options.subscriptionRequests.length) {
      await route.fulfill({
        status: 503,
        headers,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, message: 'Subscription service is temporarily unavailable.' }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      headers,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        source: options.noSubscriptionRecord ? 'user_trial' : 'company',
        subscription: options.noSubscriptionRecord ? null : subscription,
      }),
    });
    return;
  }
  if (pathname.endsWith('/subscription/plans')) {
    options.planRequests.push(Date.now());
    await route.fulfill({
      status: 200,
      headers,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, plans }),
    });
    return;
  }
  if (pathname.endsWith('/ai/agent/history')) {
    await route.fulfill({
      status: 200,
      headers,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, conversations: [{ _id: conversationId, title: 'Regression chat' }] }),
    });
    return;
  }
  if (pathname.endsWith(`/ai/agent/conversations/${conversationId}`)) {
    await route.fulfill({
      status: 200,
      headers,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        conversation: { _id: conversationId, messages: options.messages },
      }),
    });
    return;
  }
  if (pathname.endsWith('/ai/agent') && request.method() === 'POST') {
    const body = request.postDataJSON() as {
      conversationId?: string;
      history?: AgentMessage[];
      message?: string;
    };
    options.agentRequests.push(body);
    if (options.failFirstAgentRequest && options.agentRequests.length === 1) {
      await route.fulfill({
        status: 503,
        headers,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, message: 'Tavro AI is temporarily unavailable. Please retry.' }),
      });
      return;
    }
    const now = new Date().toISOString();
    options.messages.push(
      { role: 'user', content: body.message || '', createdAt: now },
      { role: 'assistant', content: 'OK response', createdAt: now }
    );
    const answer = 'OK response';
    const responseEvents = [
      `event: ready\ndata: ${JSON.stringify({ conversationId })}\n\n`,
      `event: delta\ndata: ${JSON.stringify({ text: answer })}\n\n`,
      `event: done\ndata: ${JSON.stringify({ conversationId, provider: 'gemini', toolSteps: [], tokensUsed: 1 })}\n\n`,
    ].join('');
    await route.fulfill({
      status: 200,
      headers,
      contentType: 'text/event-stream',
      body: responseEvents,
    });
    return;
  }

  await route.fulfill({
    status: 200,
    headers,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data: [], items: [], members: [], notifications: [] }),
  });
}

function makeApiState() {
  return {
    messages: [] as AgentMessage[],
    subscriptionRequests: [] as number[],
    planRequests: [] as number[],
    agentRequests: [] as Array<{ conversationId?: string; history?: AgentMessage[]; message?: string }>,
  };
}

test('Billing renders after its initial data fetch without repeatedly remounting or refetching', async ({ page }) => {
  const state = makeApiState();
  await setSessionAuth(page);
  await page.route('**/api/**', (route) => mockApi(route, {
    ...state,
    failSubscriptionRequestAt: undefined,
    failFirstAgentRequest: false,
  }));
  await page.goto('/billing');

  await expect(page.getByRole('heading', { name: 'Workspace Subscription', exact: true })).toBeVisible();
  await expect(page.getByText('Workspace Plan')).toBeVisible();
  await expect(page.getByText('Pro', { exact: true }).first()).toBeVisible();
  await page.waitForTimeout(1200);
  const settledSubscriptionRequests = state.subscriptionRequests.length;
  const settledPlanRequests = state.planRequests.length;
  await page.waitForTimeout(1500);

  expect(state.subscriptionRequests.length).toBe(settledSubscriptionRequests);
  expect(state.planRequests.length).toBe(settledPlanRequests);
  expect(settledSubscriptionRequests).toBeLessThanOrEqual(3);
  expect(settledPlanRequests).toBeLessThanOrEqual(2);
  await expect(page).toHaveURL(/\/billing$/);
});

test('Billing shows a retry state after a temporary subscription API failure', async ({ page }) => {
  const state = makeApiState();
  await setSessionAuth(page);
  await page.route('**/api/**', (route) => mockApi(route, {
    ...state,
    failSubscriptionRequestAt: 2,
    failFirstAgentRequest: false,
  }));
  await page.goto('/billing');

  await expect(page.locator('div[role="alert"].alert-danger')).toContainText(/Could not load|temporarily unavailable/i);
  await page.getByRole('button', { name: 'Retry loading billing data' }).click();
  await expect(page.getByRole('heading', { name: 'Workspace Subscription', exact: true })).toBeVisible();
  await expect(page.getByText('Workspace Plan')).toBeVisible();
});

test('Billing handles an account with no subscription record without fabricating a plan', async ({ page }) => {
  const state = makeApiState();
  await setSessionAuth(page);
  await page.route('**/api/**', (route) => mockApi(route, {
    ...state,
    failSubscriptionRequestAt: undefined,
    failFirstAgentRequest: false,
    noSubscriptionRecord: true,
  }));
  await page.goto('/billing');

  await expect(page.getByRole('heading', { name: 'Workspace Subscription', exact: true })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('No subscription record is associated');
  await expect(page.getByText('No subscription', { exact: true })).toBeVisible();
  await expect(page.getByText('Available as a 7-day trial')).toBeVisible();
});

test('Tavro keeps the same conversation through the subscription refresh and restores it after reload', async ({ page }) => {
  const state = makeApiState();
  await setSessionAuth(page);
  await page.route('**/api/**', (route) => mockApi(route, {
    ...state,
    failSubscriptionRequestAt: undefined,
    failFirstAgentRequest: false,
  }));
  await page.goto('/ai');
  const composer = page.getByPlaceholder(/Ask me to find tasks/);
  await expect(composer).toBeVisible();
  await composer.fill('Reply with the word OK.');
  const navigationCount = { value: 0 };
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) navigationCount.value += 1;
  });
  const mainFrameNavigations = navigationCount.value;
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText('OK response').first()).toBeVisible();
  await expect.poll(() => state.agentRequests.length).toBe(1);
  expect(state.agentRequests[0].conversationId).toBeUndefined();
  expect(navigationCount.value).toBe(mainFrameNavigations);
  await expect(page).toHaveURL(/\/ai$/);

  await page.reload();
  const restoredComposer = page.getByPlaceholder(/Ask me to find tasks/);
  await expect(restoredComposer).toBeVisible();
  await expect(page.getByText('Reply with the word OK.')).toBeVisible();
  await expect(page.getByText('OK response').first()).toBeVisible();

  await restoredComposer.fill('Continue in this same conversation.');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect.poll(() => state.agentRequests.length).toBe(2);
  expect(state.agentRequests[1].conversationId).toBe(conversationId);
  await expect(page.getByText('Continue in this same conversation.')).toBeVisible();
  await expect(page.getByText('OK response').last()).toBeVisible();
  await expect(page).toHaveURL(/\/ai$/);
});

test('Tavro remains on the same route when /auth/me recovers through refresh', async ({ page }) => {
  const state = makeApiState();
  const currentUser401 = { value: false };
  const refreshRequests: number[] = [];
  await setSessionAuth(page);
  await page.route('**/api/**', async (route) => {
    if (new URL(route.request().url()).pathname.endsWith('/auth/refresh')) {
      refreshRequests.push(Date.now());
    }
    await mockApi(route, {
      ...state,
      failSubscriptionRequestAt: undefined,
      failFirstAgentRequest: false,
      expireCurrentUserOnce: currentUser401,
    });
  });
  await page.goto('/ai');

  await expect(page.getByPlaceholder(/Ask me to find tasks/)).toBeVisible();
  await expect(page).toHaveURL(/\/ai$/);
  expect(refreshRequests).toHaveLength(1);
  expect(currentUser401.value).toBe(true);
});

test('Tavro shows retry controls when the agent API returns a server error', async ({ page }) => {
  const state = makeApiState();
  await setSessionAuth(page);
  await page.route('**/api/**', (route) => mockApi(route, {
    ...state,
    failSubscriptionRequestAt: undefined,
    failFirstAgentRequest: true,
  }));
  await page.goto('/ai');
  const composer = page.getByPlaceholder(/Ask me to find tasks/);
  await expect(composer).toBeVisible();
  await composer.fill('A harmless retry test.');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.locator('div[role="alert"].border-rose-300')).toContainText('Tavro AI is temporarily unavailable');
  await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByText('OK response')).toBeVisible();
  expect(state.agentRequests).toHaveLength(2);
});
