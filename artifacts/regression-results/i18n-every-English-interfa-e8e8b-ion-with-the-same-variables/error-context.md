# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: i18n.spec.ts >> every English interface message has an Urdu translation with the same variables
- Location: tests\i18n.spec.ts:25:5

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 7

- Array []
+ Array [
+   "marketing.about.stats.workspaces: identical to English",
+   "marketing.about.stats.messages: identical to English",
+   "marketing.about.stats.tasks: identical to English",
+   "marketing.about.stats.uptime: identical to English",
+   "marketing.contact.form.emailPH: identical to English",
+ ]
```

# Test source

```ts
  1   | import { expect, test, type Page, type Route } from '@playwright/test';
  2   | import { appMessagesEn, appMessagesUr, namespaceNames } from '../src/lib/i18n/messages';
  3   | import { en as marketingEn } from '../src/lib/i18n/translations/en';
  4   | import { ur as marketingUr } from '../src/lib/i18n/translations/ur';
  5   | import { formatCurrency, formatDate, formatRelativeTime, resolveMessage } from '../src/lib/i18n/core';
  6   | 
  7   | /**
  8   |  * Urdu must cover every English key, render server-side in the chosen
  9   |  * language and direction, follow the signed-in member's profile, and fall
  10  |  * back to English (never to a raw key) when a translation is missing.
  11  |  */
  12  | 
  13  | type Tree = { [key: string]: string | Tree };
  14  | 
  15  | function leaves(tree: Tree, prefix = ''): [string, string][] {
  16  |   return Object.entries(tree).flatMap(([key, value]) =>
  17  |     typeof value === 'string' ? [[`${prefix}${key}`, value] as [string, string]] : leaves(value, `${prefix}${key}.`));
  18  | }
  19  | 
  20  | const placeholders = (text: string) => [...text.matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1]).sort();
  21  | const tags = (text: string) => [...text.matchAll(/<(\w+)>/g)].map((match) => match[1]).sort();
  22  | // Strings that are legitimately the same in Urdu: product names and codes.
  23  | const SAME_IN_URDU = /^(WorkGrind|Tavro|Tavro AI|CRM|AI|API|URL|ID|PDF|CSV|2FA|MFA|LinkedIn|YouTube|Google|Polar|[\s\d.,:;%+\-–—/×·•|()[\]#@&*!?'"“”‘’$€£¥₨→←…{}A-Z_]*)$/;
  24  | 
  25  | test('every English interface message has an Urdu translation with the same variables', () => {
  26  |   const problems: string[] = [];
  27  |   const pairs: [string, Tree, Tree][] = [
  28  |     ...namespaceNames.map((name) => [name, appMessagesEn[name] as Tree, appMessagesUr[name] as Tree] as [string, Tree, Tree]),
  29  |     ...(['nav', 'footer', 'common', 'about', 'features', 'demo', 'contact'] as const)
  30  |       .map((name) => [`marketing.${name}`, marketingEn[name] as Tree, marketingUr[name] as Tree] as [string, Tree, Tree]),
  31  |   ];
  32  |   let checked = 0;
  33  |   for (const [name, english, urdu] of pairs) {
  34  |     const urduLeaves = new Map(leaves(urdu));
  35  |     for (const [key, text] of leaves(english)) {
  36  |       checked += 1;
  37  |       const translated = urduLeaves.get(key);
  38  |       if (translated === undefined) { problems.push(`${name}.${key}: missing`); continue; }
  39  |       if (!translated.trim() && text.trim()) problems.push(`${name}.${key}: empty`);
  40  |       if (placeholders(text).join() !== placeholders(translated).join()) problems.push(`${name}.${key}: variables differ`);
  41  |       if (tags(text).join() !== tags(translated).join()) problems.push(`${name}.${key}: markup tags differ`);
  42  |       if (text.trim() && translated === text && !SAME_IN_URDU.test(text)) problems.push(`${name}.${key}: identical to English`);
  43  |     }
  44  |   }
> 45  |   expect(problems).toEqual([]);
      |                    ^ Error: expect(received).toEqual(expected) // deep equality
  46  |   expect(checked).toBeGreaterThan(100);
  47  | });
  48  | 
  49  | test('a missing Urdu message falls back to English, never to the raw key', () => {
  50  |   const dictionaries = {
  51  |     en: { greeting: 'Hello {{name}}', items: { one: '{{count}} item', other: '{{count}} items' } },
  52  |     ur: {},
  53  |   };
  54  |   expect(resolveMessage(dictionaries, 'ur', 'greeting', { name: 'Ayesha' })).toBe('Hello Ayesha');
  55  |   expect(resolveMessage(dictionaries, 'en', 'items', { count: 1 })).toBe('1 item');
  56  |   expect(resolveMessage(dictionaries, 'en', 'items', { count: 1200 })).toBe('1,200 items');
  57  |   // Only a key English lacks too (a programming error) comes back as the key.
  58  |   expect(resolveMessage(dictionaries, 'ur', 'not.defined')).toBe('not.defined');
  59  | });
  60  | 
  61  | test('dates, numbers, currency and relative times follow the language', () => {
  62  |   const date = new Date('2026-03-05T10:00:00Z');
  63  |   expect(formatDate(date, { month: 'long', timeZone: 'UTC' }, 'en')).toBe('March');
  64  |   expect(formatDate(date, { month: 'long', timeZone: 'UTC' }, 'ur')).toBe('مارچ');
  65  |   expect(formatCurrency(29, 'USD', 'en')).toBe('$29.00');
  66  |   expect(formatCurrency(29, 'USD', 'ur')).toContain('29');
  67  |   expect(formatRelativeTime(new Date(Date.now() - 3 * 3600_000), 'ur')).toContain('3');
  68  |   expect(formatRelativeTime(new Date(Date.now() - 3 * 3600_000), 'en')).toBe('3 hours ago');
  69  | });
  70  | 
  71  | // ── Rendering ───────────────────────────────────────────────────────────────
  72  | 
  73  | const corsHeaders = (route: Route) => ({
  74  |   'access-control-allow-origin': route.request().headers().origin ?? 'http://127.0.0.1:3101',
  75  |   'access-control-allow-credentials': 'true',
  76  |   'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  77  |   'access-control-allow-headers': 'Authorization,Content-Type,Cache-Control',
  78  | });
  79  | 
  80  | const entitlements = {
  81  |   crm: true, tasksProjects: true, teamChat: true, meetingsCalendar: true,
  82  |   fileStorage: true, aiAssistant: true, prioritySupport: true, advancedAnalytics: true,
  83  | };
  84  | 
  85  | async function signIn(page: Page, user: { preferredLanguage?: string } = {}) {
  86  |   const profileUpdates: unknown[] = [];
  87  |   const profile = {
  88  |     _id: 'i18n-member', fullName: 'Ayesha Khan', email: 'ayesha@example.invalid', role: 'owner',
  89  |     companyId: { _id: 'i18n-company', name: 'Lahore Studio', organizationType: 'business', accountType: 'company' },
  90  |     theme: 'light', ...user,
  91  |   };
  92  |   await page.routeWebSocket('**/socket.io/**', (socket) => socket.close({ code: 1000, reason: 'Socket.IO is not under test.' }));
  93  |   await page.addInitScript(() => {
  94  |     sessionStorage.setItem('workgrind_access_token', 'playwright-i18n-access');
  95  |     sessionStorage.setItem('workgrind_refresh_token', 'playwright-i18n-refresh');
  96  |   });
  97  |   await page.route('**/api/**', async (route) => {
  98  |     const request = route.request();
  99  |     const { pathname } = new URL(request.url());
  100 |     const json = (body: unknown, status = 200) =>
  101 |       route.fulfill({ status, headers: corsHeaders(route), contentType: 'application/json', body: JSON.stringify(body) });
  102 |     if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: corsHeaders(route) });
  103 |     if (pathname.endsWith('/auth/me')) return json({ success: true, user: profile });
  104 |     if (pathname.endsWith('/users/me') && request.method() === 'PATCH') {
  105 |       const body = request.postDataJSON() as Record<string, unknown>;
  106 |       profileUpdates.push(body);
  107 |       Object.assign(profile, body);
  108 |       return json({ success: true, user: profile });
  109 |     }
  110 |     if (pathname.endsWith('/subscription/status')) {
  111 |       return json({
  112 |         success: true, source: 'company',
  113 |         subscription: {
  114 |           status: 'active', plan: 'pro', planName: 'Pro', priceDisplay: '$29/month', hasActiveAccess: true,
  115 |           trialDaysRemaining: null, cancelAtPeriodEnd: false, entitlements,
  116 |           limits: { members: 25, storage: 10_000_000_000, aiRequests: 500 },
  117 |           usage: { members: 1, pendingInvites: 0, memberSlotsUsed: 1, storageBytes: 0, aiRequests: 0, aiRequestsByUser: 0 },
  118 |         },
  119 |       });
  120 |     }
  121 |     return json({ success: true, data: [], items: [], members: [], notifications: [], tasks: [], projects: [] });
  122 |   });
  123 |   return { profileUpdates };
  124 | }
  125 | 
  126 | test('the server renders a visitor’s chosen language and direction on first paint', async ({ page, baseURL }) => {
  127 |   const response = await page.request.get(`${baseURL}/about`, { headers: { cookie: 'workgrind_lang=ur' } });
  128 |   const html = await response.text();
  129 |   expect(html).toMatch(/<html[^>]*lang="ur"/);
  130 |   expect(html).toMatch(/<html[^>]*dir="rtl"/);
  131 |   expect(html).toContain('سائن ان');
  132 | 
  133 |   const english = await (await page.request.get(`${baseURL}/about`)).text();
  134 |   expect(english).toMatch(/<html[^>]*lang="en"/);
  135 |   expect(english).toMatch(/<html[^>]*dir="ltr"/);
  136 | });
  137 | 
  138 | test('the signed-in app shell is in Urdu and right-to-left', async ({ page, context, baseURL }) => {
  139 |   await context.addCookies([{ name: 'workgrind_lang', value: 'ur', url: baseURL! }]);
  140 |   await signIn(page, { preferredLanguage: 'ur' });
  141 |   await page.goto('/tasks');
  142 | 
  143 |   const sidebar = page.locator('aside.workspace-sidebar');
  144 |   await expect(sidebar.getByRole('link', { name: 'ٹاسکس' })).toBeVisible();
  145 |   await expect(sidebar.getByRole('link', { name: 'ترتیبات' })).toBeVisible();
```