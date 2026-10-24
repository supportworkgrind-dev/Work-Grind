import { expect, test, type Page, type Route } from '@playwright/test';
import { appMessagesEn, appMessagesUr, namespaceNames } from '../src/lib/i18n/messages';
import { en as marketingEn } from '../src/lib/i18n/translations/en';
import { ur as marketingUr } from '../src/lib/i18n/translations/ur';
import { formatCurrency, formatDate, formatRelativeTime, resolveMessage } from '../src/lib/i18n/core';

/**
 * Urdu must cover every English key, render server-side in the chosen
 * language and direction, follow the signed-in member's profile, and fall
 * back to English (never to a raw key) when a translation is missing.
 */

type Tree = { [key: string]: string | Tree };

function leaves(tree: Tree, prefix = ''): [string, string][] {
  return Object.entries(tree).flatMap(([key, value]) =>
    typeof value === 'string' ? [[`${prefix}${key}`, value] as [string, string]] : leaves(value, `${prefix}${key}.`));
}

const placeholders = (text: string) => [...text.matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1]).sort();
const tags = (text: string) => [...text.matchAll(/<(\w+)>/g)].map((match) => match[1]).sort();
// Strings that are legitimately the same in Urdu: product names and codes.
const SAME_IN_URDU = /^([\w.+-]+@[\w.-]+|WorkGrind|Tavro|Tavro AI|CRM|AI|API|URL|ID|PDF|CSV|2FA|MFA|LinkedIn|YouTube|Google|Polar|[\s\d.,:;%+\-–—/×·•|()[\]#@&*!?'"“”‘’$€£¥₨→←…{}A-Z_]*)$/;

test('every English interface message has an Urdu translation with the same variables', () => {
  const problems: string[] = [];
  const pairs: [string, Tree, Tree][] = [
    ...namespaceNames.map((name) => [name, appMessagesEn[name] as Tree, appMessagesUr[name] as Tree] as [string, Tree, Tree]),
    ...(['nav', 'footer', 'common', 'about', 'features', 'demo', 'contact'] as const)
      .map((name) => [`marketing.${name}`, marketingEn[name] as Tree, marketingUr[name] as Tree] as [string, Tree, Tree]),
  ];
  let checked = 0;
  for (const [name, english, urdu] of pairs) {
    const urduLeaves = new Map(leaves(urdu));
    for (const [key, text] of leaves(english)) {
      checked += 1;
      const translated = urduLeaves.get(key);
      if (translated === undefined) { problems.push(`${name}.${key}: missing`); continue; }
      if (!translated.trim() && text.trim()) problems.push(`${name}.${key}: empty`);
      if (placeholders(text).join() !== placeholders(translated).join()) problems.push(`${name}.${key}: variables differ`);
      if (tags(text).join() !== tags(translated).join()) problems.push(`${name}.${key}: markup tags differ`);
      if (text.trim() && translated === text && !SAME_IN_URDU.test(text)) problems.push(`${name}.${key}: identical to English`);
    }
  }
  expect(problems).toEqual([]);
  expect(checked).toBeGreaterThan(100);
});

test('a missing Urdu message falls back to English, never to the raw key', () => {
  const dictionaries = {
    en: { greeting: 'Hello {{name}}', items: { one: '{{count}} item', other: '{{count}} items' } },
    ur: {},
  };
  expect(resolveMessage(dictionaries, 'ur', 'greeting', { name: 'Ayesha' })).toBe('Hello Ayesha');
  expect(resolveMessage(dictionaries, 'en', 'items', { count: 1 })).toBe('1 item');
  expect(resolveMessage(dictionaries, 'en', 'items', { count: 1200 })).toBe('1,200 items');
  // Only a key English lacks too (a programming error) comes back as the key.
  expect(resolveMessage(dictionaries, 'ur', 'not.defined')).toBe('not.defined');
});

test('API errors are shown in Urdu by error code, and English keeps the server’s message', async () => {
  const { setActiveLanguage } = await import('../src/lib/i18n/core');
  const { describeApiError } = await import('../src/lib/apiError');
  const dictionaries = { en: { ...marketingEn, ...appMessagesEn }, ur: { ...marketingUr, ...appMessagesUr } };
  const planError = {
    isAxiosError: true,
    response: { status: 403, data: { code: 'PLAN_UPGRADE_REQUIRED', message: 'Upgrade to Pro to use analytics.' } },
  };
  const unknownServerError = { isAxiosError: true, response: { status: 500, data: { message: 'Mongo timeout' } } };
  const globals = globalThis as { window?: unknown };
  const hadWindow = 'window' in globals;
  globals.window = globals.window ?? {};
  try {
    setActiveLanguage('en', dictionaries);
    expect(describeApiError(planError).message).toBe('Upgrade to Pro to use analytics.');
    setActiveLanguage('ur', dictionaries);
    expect(describeApiError(planError).message).toBe(appMessagesUr.common.apiCodes.PLAN_UPGRADE_REQUIRED);
    expect(describeApiError(unknownServerError).message).toBe(appMessagesUr.common.errors.server);
  } finally {
    setActiveLanguage('en', dictionaries);
    if (!hadWindow) delete globals.window;
  }
});

test('a missing translation is reported in development', () => {
  const warnings: string[] = [];
  const original = console.warn;
  console.warn = (message: string) => { warnings.push(message); };
  try {
    resolveMessage({ en: { onlyEnglish: 'Only English' }, ur: {} }, 'ur', 'onlyEnglish');
  } finally {
    console.warn = original;
  }
  expect(warnings).toEqual(['[i18n] Missing ur message "onlyEnglish"; showing English.']);
});

test('dates, numbers, currency and relative times follow the language', () => {
  const date = new Date('2026-03-05T10:00:00Z');
  expect(formatDate(date, { month: 'long', timeZone: 'UTC' }, 'en')).toBe('March');
  expect(formatDate(date, { month: 'long', timeZone: 'UTC' }, 'ur')).toBe('مارچ');
  expect(formatCurrency(29, 'USD', 'en')).toBe('$29.00');
  expect(formatCurrency(29, 'USD', 'ur')).toContain('29');
  expect(formatRelativeTime(new Date(Date.now() - 3 * 3600_000), 'ur')).toContain('3');
  expect(formatRelativeTime(new Date(Date.now() - 3 * 3600_000), 'en')).toBe('3 hours ago');
});

// ── Rendering ───────────────────────────────────────────────────────────────

const corsHeaders = (route: Route) => ({
  'access-control-allow-origin': route.request().headers().origin ?? 'http://127.0.0.1:3101',
  'access-control-allow-credentials': 'true',
  'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'access-control-allow-headers': 'Authorization,Content-Type,Cache-Control',
});

const entitlements = {
  crm: true, tasksProjects: true, teamChat: true, meetingsCalendar: true,
  fileStorage: true, aiAssistant: true, prioritySupport: true, advancedAnalytics: true,
};

async function signIn(page: Page, user: { preferredLanguage?: string } = {}) {
  const profileUpdates: unknown[] = [];
  const profile = {
    _id: 'i18n-member', fullName: 'Ayesha Khan', email: 'ayesha@example.invalid', role: 'owner',
    companyId: { _id: 'i18n-company', name: 'Lahore Studio', organizationType: 'business', accountType: 'company' },
    theme: 'light', ...user,
  };
  await page.routeWebSocket('**/socket.io/**', (socket) => socket.close({ code: 1000, reason: 'Socket.IO is not under test.' }));
  await page.addInitScript(() => {
    sessionStorage.setItem('workgrind_access_token', 'playwright-i18n-access');
    sessionStorage.setItem('workgrind_refresh_token', 'playwright-i18n-refresh');
  });
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, headers: corsHeaders(route), contentType: 'application/json', body: JSON.stringify(body) });
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: corsHeaders(route) });
    if (pathname.endsWith('/auth/me')) return json({ success: true, user: profile });
    if (pathname.endsWith('/users/me') && request.method() === 'PATCH') {
      const body = request.postDataJSON() as Record<string, unknown>;
      profileUpdates.push(body);
      Object.assign(profile, body);
      return json({ success: true, user: profile });
    }
    if (pathname.endsWith('/subscription/status')) {
      return json({
        success: true, source: 'company',
        subscription: {
          status: 'active', plan: 'pro', planName: 'Pro', priceDisplay: '$29/month', hasActiveAccess: true,
          trialDaysRemaining: null, cancelAtPeriodEnd: false, entitlements,
          limits: { members: 25, storage: 10_000_000_000, aiRequests: 500 },
          usage: { members: 1, pendingInvites: 0, memberSlotsUsed: 1, storageBytes: 0, aiRequests: 0, aiRequestsByUser: 0 },
        },
      });
    }
    return json({ success: true, data: [], items: [], members: [], notifications: [], tasks: [], projects: [] });
  });
  return { profileUpdates };
}

test('the server renders a visitor’s chosen language and direction on first paint', async ({ page, baseURL }) => {
  const response = await page.request.get(`${baseURL}/about`, { headers: { cookie: 'workgrind_lang=ur' } });
  const html = await response.text();
  expect(html).toMatch(/<html[^>]*lang="ur"/);
  expect(html).toMatch(/<html[^>]*dir="rtl"/);
  expect(html).toContain('سائن ان');

  const english = await (await page.request.get(`${baseURL}/about`)).text();
  expect(english).toMatch(/<html[^>]*lang="en"/);
  expect(english).toMatch(/<html[^>]*dir="ltr"/);
});

test('the signed-in app shell is in Urdu and right-to-left', async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: 'workgrind_lang', value: 'ur', url: baseURL! }]);
  await signIn(page, { preferredLanguage: 'ur' });
  await page.goto('/tasks');

  const sidebar = page.locator('aside.workspace-sidebar');
  await expect(sidebar.getByRole('link', { name: 'ٹاسکس' })).toBeVisible();
  await expect(sidebar.getByRole('link', { name: 'ترتیبات' })).toBeVisible();
  await expect(sidebar.getByText('Settings', { exact: true })).toHaveCount(0);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ur');
  // The sidebar sits on the right in RTL.
  const box = await sidebar.boundingBox();
  const width = page.viewportSize()!.width;
  expect(box!.x + box!.width).toBeGreaterThan(width - 2);
});

test('switching to Urdu in Settings saves it to the profile, updates the interface at once, and survives a reload', async ({ page }) => {
  const { profileUpdates } = await signIn(page, { preferredLanguage: 'en' });
  await page.goto('/settings');
  await page.getByRole('button', { name: /Preferences & Appearance/ }).click();
  await page.locator('#settings-language').selectOption('ur');

  await expect.poll(() => profileUpdates).toContainEqual({ preferredLanguage: 'ur' });
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('aside.workspace-sidebar').getByRole('link', { name: 'ترتیبات' })).toBeVisible();

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ur');
  await expect(page.locator('aside.workspace-sidebar').getByRole('link', { name: 'ٹاسکس' })).toBeVisible();
});

test('a visitor’s language choice is kept on the device and rendered by the server on the next visit', async ({ page, context }) => {
  let profileWrites = 0;
  await page.route('**/api/**', async (route) => {
    if (route.request().method() === 'PATCH') profileWrites += 1;
    await route.fulfill({ status: 401, headers: corsHeaders(route), contentType: 'application/json', body: '{"success":false}' });
  });
  await page.goto('/about');
  await page.getByRole('button', { name: /select language/ }).first().click();
  await page.getByRole('option', { name: /Urdu/ }).click();

  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  expect((await context.cookies()).find((cookie) => cookie.name === 'workgrind_lang')?.value).toBe('ur');
  const html = await (await page.request.get('/about')).text();
  expect(html).toMatch(/<html[^>]*lang="ur"/);
  expect(profileWrites).toBe(0);
});

test('a member’s profile language is applied on a device that has no saved choice', async ({ page, context }) => {
  await signIn(page, { preferredLanguage: 'ur' });
  await page.goto('/tasks');

  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('aside.workspace-sidebar').getByRole('link', { name: 'ٹاسکس' })).toBeVisible();
  const cookies = await context.cookies();
  expect(cookies.find((cookie) => cookie.name === 'workgrind_lang')?.value).toBe('ur');
});
