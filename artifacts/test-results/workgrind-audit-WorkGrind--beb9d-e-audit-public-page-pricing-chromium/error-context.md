# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: workgrind-audit.spec.ts >> WorkGrind public-site audit >> public page /pricing
- Location: tests\workgrind-audit.spec.ts:218:9

# Error details

```
Error: /pricing audit issues

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 4

- Array []
+ Array [
+   "401 POST https://workgrind.vercel.app/api/auth/refresh",
+   "Console error: Failed to load resource: the server responded with a status of 401 ()",
+ ]
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - navigation [ref=e3]:
      - link "WG WorkGrind" [ref=e4] [cursor=pointer]:
        - /url: /
        - generic [ref=e5]: WG
        - text: WorkGrind
      - generic [ref=e6]:
        - link "Log in" [ref=e7] [cursor=pointer]:
          - /url: /login
        - link "View plans" [ref=e8] [cursor=pointer]:
          - /url: /signup
    - generic [ref=e9]:
      - generic [ref=e10]:
        - generic [ref=e11]: Simple, transparent pricing
        - heading "Plans for the workspace you choose. Clear pricing, no guesswork." [level=1] [ref=e12]: Plans for the workspace you choose.Clear pricing, no guesswork.
        - paragraph [ref=e13]: Solo and Company plans are listed separately from backend-configured education plans. Plan features, limits, prices, and applicable trial terms are shown with each plan.
      - generic [ref=e14]:
        - generic [ref=e15]:
          - generic [ref=e16]:
            - paragraph [ref=e17]: Free Trial
            - generic [ref=e18]: Free
            - paragraph [ref=e20]: 7-day free trial
            - paragraph [ref=e21]: 7-day full-access trial. A paid subscription is required after the trial ends.
          - link "Start 7-Day Free Trial" [ref=e23] [cursor=pointer]:
            - /url: /signup
          - list [ref=e26]:
            - listitem [ref=e27]: CRM (contacts, companies, deals)
            - listitem [ref=e31]: Tasks & Projects
            - listitem [ref=e35]: Team Chat
            - listitem [ref=e39]: Meetings & Calendar
            - listitem [ref=e43]: File Storage (1 GB)
            - listitem [ref=e47]: AI Assistant (50 req/mo)
            - listitem [ref=e51]: Up to 5 members
            - listitem [ref=e55]: Priority Support
            - listitem [ref=e59]: Advanced Analytics
        - generic [ref=e63]:
          - generic [ref=e64]:
            - paragraph [ref=e65]: Starter
            - generic [ref=e66]:
              - generic [ref=e67]: $9
              - generic [ref=e68]: /month
            - paragraph [ref=e69]: Everything you need for a small team or solo professional.
          - button "Get Starter" [ref=e71] [cursor=pointer]
          - list [ref=e74]:
            - listitem [ref=e75]: CRM (contacts, companies, deals)
            - listitem [ref=e79]: Tasks & Projects
            - listitem [ref=e83]: Team Chat
            - listitem [ref=e87]: Meetings & Calendar
            - listitem [ref=e91]: File Storage (10 GB)
            - listitem [ref=e95]: AI Assistant (200 req/mo)
            - listitem [ref=e99]: Up to 20 members
            - listitem [ref=e103]: Priority Support
            - listitem [ref=e107]: Advanced Analytics
        - generic [ref=e111]:
          - generic [ref=e112]: Most Popular
          - generic [ref=e113]:
            - paragraph [ref=e114]: Pro
            - generic [ref=e115]:
              - generic [ref=e116]: $19
              - generic [ref=e117]: /month
            - paragraph [ref=e118]: All features, unlimited members, priority support.
          - button "Get Pro" [ref=e120] [cursor=pointer]
          - list [ref=e123]:
            - listitem [ref=e124]: CRM (contacts, companies, deals)
            - listitem [ref=e128]: Tasks & Projects
            - listitem [ref=e132]: Team Chat
            - listitem [ref=e136]: Meetings & Calendar
            - listitem [ref=e140]: File Storage (100 GB)
            - listitem [ref=e144]: AI Assistant (unlimited)
            - listitem [ref=e148]: Unlimited members
            - listitem [ref=e152]: Priority Support
            - listitem [ref=e156]: Advanced Analytics
      - region [ref=e160]:
        - generic [ref=e161]:
          - heading "Education pricing" [level=2] [ref=e162]
          - paragraph [ref=e163]: Monthly plans for schools, colleges, and universities.
        - generic [ref=e164]:
          - article [ref=e165]:
            - heading "WorkGrind School" [level=3] [ref=e166]
            - paragraph [ref=e167]:
              - text: $19 USD
              - generic [ref=e168]: /month
            - paragraph [ref=e169]: Monthly subscription for schools and academies.
            - list [ref=e170]:
              - listitem [ref=e171]: Up to 200 active students
              - listitem [ref=e172]: Up to 25 active staff and members
              - listitem [ref=e173]: Up to 50 pending invitations
          - article [ref=e174]:
            - heading "WorkGrind College" [level=3] [ref=e175]
            - paragraph [ref=e176]:
              - text: $49 USD
              - generic [ref=e177]: /month
            - paragraph [ref=e178]: Monthly subscription for colleges.
            - list [ref=e179]:
              - listitem [ref=e180]: Up to 750 active students
              - listitem [ref=e181]: Up to 75 active staff and members
              - listitem [ref=e182]: Up to 150 pending invitations
          - article [ref=e183]:
            - heading "WorkGrind University" [level=3] [ref=e184]
            - paragraph [ref=e185]:
              - text: $99 USD
              - generic [ref=e186]: /month
            - paragraph [ref=e187]: Monthly subscription for universities.
            - list [ref=e188]:
              - listitem [ref=e189]: Up to 2,000 active students
              - listitem [ref=e190]: Up to 200 active staff and members
              - listitem [ref=e191]: Up to 500 pending invitations
        - paragraph [ref=e192]: Education checkout requires a matching monthly USD Polar product and is available after workspace setup.
      - generic [ref=e193]:
        - heading "Everything in one connected workspace" [level=2] [ref=e194]
        - generic [ref=e195]:
          - generic [ref=e196]:
            - paragraph [ref=e202]: CRM & Pipeline
            - paragraph [ref=e203]: Contacts, companies, deals
          - generic [ref=e204]:
            - paragraph [ref=e211]: Team Management
            - paragraph [ref=e212]: Roles, workload, presence
          - generic [ref=e213]:
            - paragraph [ref=e217]: Team Chat
            - paragraph [ref=e218]: Channels, DMs, threads
          - generic [ref=e219]:
            - paragraph [ref=e224]: Projects & Tasks
            - paragraph [ref=e225]: Kanban, milestones, tracking
          - generic [ref=e226]:
            - paragraph [ref=e230]: Calendar & Meetings
            - paragraph [ref=e231]: Scheduling, video, notes
          - generic [ref=e232]:
            - paragraph [ref=e237]: Tavro AI
            - paragraph [ref=e238]: Smart summaries & actions
          - generic [ref=e239]:
            - paragraph [ref=e243]: Security & RBAC
            - paragraph [ref=e244]: Roles, audit logs, MFA
          - generic [ref=e245]:
            - paragraph [ref=e249]: Plan-based features
            - paragraph [ref=e250]: Feature access depends on your workspace type, role, and plan.
      - generic [ref=e251]:
        - heading "Frequently asked questions" [level=2] [ref=e252]
        - generic [ref=e253]:
          - button "Which workspace should I choose?" [ref=e255] [cursor=pointer]
          - button "Can Tavro AI help with business and education work?" [ref=e259] [cursor=pointer]
          - button "Does the free trial require a credit card?" [ref=e263] [cursor=pointer]
          - button "What happens when my trial expires?" [ref=e267] [cursor=pointer]
          - button "Can I upgrade or downgrade at any time?" [ref=e271] [cursor=pointer]
          - button "How do I cancel my subscription?" [ref=e275] [cursor=pointer]
          - button "Is my payment information secure?" [ref=e279] [cursor=pointer]
          - button "Can I get a refund?" [ref=e283] [cursor=pointer]
      - generic [ref=e286]:
        - paragraph [ref=e287]: Still have questions?
        - link "Contact our team" [ref=e288] [cursor=pointer]:
          - /url: /contact
  - alert [ref=e291]
```

# Test source

```ts
  158 |       .filter((src) => {
  159 |         try {
  160 |           return new URL(src).origin === location.origin;
  161 |         } catch {
  162 |           return false;
  163 |         }
  164 |       }))]
  165 |   );
  166 |   const secretMarkers: string[] = [];
  167 |   for (const src of scripts) {
  168 |     try {
  169 |       const scriptResponse = await page.request.get(src, { timeout: 10_000 });
  170 |       const scriptText = await scriptResponse.text();
  171 |       const marker = scriptText.match(
  172 |         /(?:sk_(?:live|test)_[A-Za-z0-9]{16,}|AIza[0-9A-Za-z_-]{30,}|-----BEGIN (?:RSA |EC )?PRIVATE KEY-----|mongodb(?:\+srv)?:\/\/[^\s"'<>]{10,})/
  173 |       );
  174 |       if (marker) secretMarkers.push(`${safeUrl(src)} (${marker[0].startsWith('mongodb') ? 'database URI' : 'key/token marker'})`);
  175 |     } catch {
  176 |       // The browser network audit records failed resource requests separately.
  177 |     }
  178 |   }
  179 |   const unlabeledButtons = await page.locator('button').evaluateAll((buttons) =>
  180 |     buttons
  181 |       .filter((button) => {
  182 |         const hasName =
  183 |           button.textContent?.trim() ||
  184 |           button.getAttribute('aria-label') ||
  185 |           button.getAttribute('title') ||
  186 |           button.querySelector('img[alt], svg[aria-label], [aria-labelledby]');
  187 |         return !hasName;
  188 |       })
  189 |       .map((button) => button.outerHTML.slice(0, 240))
  190 |   );
  191 |   const oldBrandMatches = pageText
  192 |     .split(/\r?\n/)
  193 |     .map((line) => line.trim())
  194 |     .filter((line) => oldBrandPattern.test(line))
  195 |     .map((line) => safeText(line).slice(0, 240));
  196 | 
  197 |   return {
  198 |     response,
  199 |     elapsedMs,
  200 |     status: response?.status() ?? null,
  201 |     securityHeaders: response ? await response.allHeaders() : {},
  202 |     title,
  203 |     pageText,
  204 |     imageFailures,
  205 |     overflow,
  206 |     emptyLinks,
  207 |     brokenInternalLinks,
  208 |     secretMarkers,
  209 |     unlabeledButtons,
  210 |     oldBrandMatches,
  211 |     runtimeIssues: runtime.issues,
  212 |     stopTracking: runtime.stop,
  213 |   };
  214 | }
  215 | 
  216 | test.describe('WorkGrind public-site audit', () => {
  217 |   for (const path of publicPaths) {
  218 |     test(`public page ${path}`, async ({ page }) => {
  219 |       const audit = await inspectPage(page, path);
  220 |       expect(audit.response, `${path} navigation returned no HTTP response`).not.toBeNull();
  221 |       expect(audit.response!.status(), `${path} navigation status`).toBeLessThan(400);
  222 |       expect(audit.title, `${path} should have a document title`).toBeTruthy();
  223 |       expect(audit.pageText.trim().length, `${path} should render visible content`).toBeGreaterThan(20);
  224 |       const issues = [
  225 |         ...audit.imageFailures.map((item) => `Broken image: ${item}`),
  226 |         ...(audit.overflow.scrollWidth > audit.overflow.clientWidth + 2
  227 |           ? [`Horizontal overflow: ${audit.overflow.scrollWidth}px content / ${audit.overflow.clientWidth}px viewport`]
  228 |           : []),
  229 |         ...audit.emptyLinks.map((item) => `Link without destination: ${item}`),
  230 |         ...audit.brokenInternalLinks.map((item) => `Broken internal link: ${item}`),
  231 |         ...audit.secretMarkers.map((item) => `Potential secret exposed in client bundle: ${item}`),
  232 |         ...audit.unlabeledButtons.map((item) => `Button without accessible name: ${safeText(item)}`),
  233 |         ...audit.oldBrandMatches.map((item) => `Old-brand text: ${item}`),
  234 |         ...audit.runtimeIssues,
  235 |       ];
  236 |       await test.info().attach('page-audit.json', {
  237 |         body: JSON.stringify({
  238 |           url: safeUrl(page.url()),
  239 |           path,
  240 |           status: audit.status,
  241 |           contentSecurityPolicy: Boolean(audit.securityHeaders['content-security-policy']),
  242 |           strictTransportSecurity: Boolean(audit.securityHeaders['strict-transport-security']),
  243 |           setCookieAttributes: (audit.securityHeaders['set-cookie'] || '')
  244 |             .split(/,(?=[^;]+=[^;]+)/)
  245 |             .filter(Boolean)
  246 |             .map((cookie) => ({
  247 |               secure: /;\s*secure\b/i.test(cookie),
  248 |               httpOnly: /;\s*httponly\b/i.test(cookie),
  249 |               sameSite: cookie.match(/;\s*samesite=([^;]+)/i)?.[1] || null,
  250 |             })),
  251 |           title: safeText(audit.title),
  252 |           elapsedMs: audit.elapsedMs,
  253 |           issues,
  254 |           oldBrandMatches: audit.oldBrandMatches,
  255 |         }, null, 2),
  256 |         contentType: 'application/json',
  257 |       });
> 258 |       expect(issues, `${path} audit issues`).toEqual([]);
      |                                              ^ Error: /pricing audit issues
  259 |       test.info().annotations.push({ type: 'navigation-ms', description: String(audit.elapsedMs) });
  260 |       audit.stopTracking();
  261 |     });
  262 |   }
  263 | });
  264 | 
  265 | test('responsive layouts on key public pages', async ({ page }) => {
  266 |   const issues: string[] = [];
  267 |   for (const viewport of [
  268 |     { name: 'desktop', width: 1440, height: 900 },
  269 |     { name: 'laptop', width: 1280, height: 720 },
  270 |     { name: 'tablet', width: 768, height: 1024 },
  271 |     { name: 'mobile', width: 390, height: 844 },
  272 |   ]) {
  273 |     await page.setViewportSize({ width: viewport.width, height: viewport.height });
  274 |     for (const path of ['/', '/pricing', '/signup', '/login']) {
  275 |       try {
  276 |         await page.goto(path, { waitUntil: 'domcontentloaded' });
  277 |         const sizes = await page.evaluate(() => ({
  278 |           body: document.body.scrollWidth,
  279 |           viewport: document.documentElement.clientWidth,
  280 |         }));
  281 |         if (sizes.body > sizes.viewport + 2) {
  282 |           issues.push(`${viewport.name} ${path}: ${sizes.body}px content exceeds ${sizes.viewport}px viewport`);
  283 |         }
  284 |       } catch (error) {
  285 |         issues.push(`${viewport.name} ${path}: ${error instanceof Error ? error.message : 'navigation failed'}`);
  286 |       }
  287 |     }
  288 |   }
  289 |   await test.info().attach('responsive-audit.json', {
  290 |     body: JSON.stringify({ issues }, null, 2),
  291 |     contentType: 'application/json',
  292 |   });
  293 |   expect(issues).toEqual([]);
  294 | });
  295 | 
  296 | test('login form exposes required email/password fields and blocks empty submission', async ({ page }) => {
  297 |   await page.goto('/login', { waitUntil: 'domcontentloaded' });
  298 |   const email = page.locator('input[type="email"]');
  299 |   const password = page.locator('input[type="password"]');
  300 |   await expect(email).toHaveCount(1);
  301 |   await expect(password).toHaveCount(1);
  302 |   await expect(page.locator('button[type="submit"]')).toHaveCount(1);
  303 |   expect(await email.evaluate((input: HTMLInputElement) => input.required)).toBe(true);
  304 |   expect(await password.evaluate((input: HTMLInputElement) => input.required)).toBe(true);
  305 |   await page.locator('button[type="submit"]').click();
  306 |   expect(await email.evaluate((input: HTMLInputElement) => input.validity.valueMissing)).toBe(true);
  307 |   expect(new URL(page.url()).pathname).toBe('/login');
  308 | });
  309 | 
  310 | test('protected application routes redirect unauthenticated visitors', async ({ page }) => {
  311 |   const results: Array<{ path: string; status: number | null; landedAt: string }> = [];
  312 |   const issues: string[] = [];
  313 |   for (const path of authenticatedPaths) {
  314 |     try {
  315 |       const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
  316 |       await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);
  317 |       const landedAt = new URL(page.url()).pathname;
  318 |       results.push({ path, status: response?.status() ?? null, landedAt });
  319 |       if (!/\/login\/?$/.test(landedAt)) issues.push(`${path} resolved to ${landedAt}, not login`);
  320 |     } catch (error) {
  321 |       issues.push(`${path}: ${error instanceof Error ? safeText(error.message) : 'navigation failed'}`);
  322 |       results.push({ path, status: null, landedAt: safeUrl(page.url()) });
  323 |     }
  324 |   }
  325 |   await test.info().attach('protected-route-audit.json', {
  326 |     body: JSON.stringify({ results, issues }, null, 2),
  327 |     contentType: 'application/json',
  328 |   });
  329 |   expect(issues).toEqual([]);
  330 | });
  331 | 
  332 | test('authenticated routes and read-only feature audit', async ({ page }) => {
  333 |   const email = process.env.WORKGRIND_TEST_EMAIL;
  334 |   const password = process.env.WORKGRIND_TEST_PASSWORD;
  335 |   test.skip(!email || !password, 'Set WORKGRIND_TEST_EMAIL and WORKGRIND_TEST_PASSWORD in the environment to run authenticated checks.');
  336 | 
  337 |   const loginRuntime = trackRuntime(page);
  338 |   await page.goto('/login', { waitUntil: 'domcontentloaded' });
  339 |   await page.locator('input[type="email"]').fill(email!);
  340 |   await page.locator('input[type="password"]').fill(password!);
  341 |   await page.locator('button[type="submit"]').click();
  342 |   await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 30_000 });
  343 | 
  344 |   const storageState = await page.evaluate(() =>
  345 |     Object.keys(localStorage).map((name) => name.toLowerCase())
  346 |   );
  347 |   const cookies = await page.context().cookies();
  348 |   const authEvidence = {
  349 |     redirectedTo: safeUrl(page.url()),
  350 |     storageKeyNames: storageState.filter((name) => /auth|token|session/.test(name)),
  351 |     cookies: cookies
  352 |       .filter((cookie) => /auth|token|session/i.test(cookie.name))
  353 |       .map(({ name, secure, httpOnly, sameSite }) => ({ name, secure, httpOnly, sameSite })),
  354 |   };
  355 |   test.info().annotations.push({
  356 |     type: 'session-evidence',
  357 |     description: JSON.stringify(authEvidence),
  358 |   });
```