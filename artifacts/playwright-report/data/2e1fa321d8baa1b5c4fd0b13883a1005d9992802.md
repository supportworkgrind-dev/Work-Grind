# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: workgrind-audit.spec.ts >> WorkGrind public-site audit >> public page /pricing
- Location: tests\workgrind-audit.spec.ts:215:9

# Error details

```
Error: /pricing audit issues

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 3

- Array []
+ Array [
+   "Old-brand text: TF",
+ ]
```

# Page snapshot

```yaml
- generic [active] [ref=f1e1]:
  - generic [ref=f1e2]:
    - navigation [ref=f1e3]:
      - link "TF WorkGrind" [ref=f1e4] [cursor=pointer]:
        - /url: /
        - generic [ref=f1e5]: TF
        - text: WorkGrind
      - generic [ref=f1e6]:
        - link "Log in" [ref=f1e7] [cursor=pointer]:
          - /url: /login
        - link "Start free trial" [ref=f1e8] [cursor=pointer]:
          - /url: /signup
    - generic [ref=f1e9]:
      - generic [ref=f1e10]:
        - generic [ref=f1e11]: Simple, transparent pricing
        - heading "Try it free for 7 days. Scale when you're ready." [level=1] [ref=f1e12]: Try it free for 7 days.Scale when you're ready.
        - paragraph [ref=f1e13]: Every account starts with a full 7-day free trial with access to all features. Choose a paid plan before your trial ends to keep your access.
      - generic [ref=f1e14]:
        - generic [ref=f1e15]:
          - generic [ref=f1e16]:
            - paragraph [ref=f1e17]: Free Trial
            - generic [ref=f1e18]: Free
            - paragraph [ref=f1e20]: 7-day free trial
            - paragraph [ref=f1e21]: 7-day full-access trial. A paid subscription is required after the trial ends.
          - link "Start 7-Day Free Trial" [ref=f1e23] [cursor=pointer]:
            - /url: /signup
          - list [ref=f1e26]:
            - listitem [ref=f1e27]: CRM (contacts, companies, deals)
            - listitem [ref=f1e31]: Tasks & Projects
            - listitem [ref=f1e35]: Team Chat
            - listitem [ref=f1e39]: Meetings & Calendar
            - listitem [ref=f1e43]: File Storage (1 GB)
            - listitem [ref=f1e47]: AI Assistant (50 req/mo)
            - listitem [ref=f1e51]: Up to 5 members
            - listitem [ref=f1e55]: Priority Support
            - listitem [ref=f1e59]: Advanced Analytics
        - generic [ref=f1e63]:
          - generic [ref=f1e64]:
            - paragraph [ref=f1e65]: Starter
            - generic [ref=f1e66]:
              - generic [ref=f1e67]: $9
              - generic [ref=f1e68]: /month
            - paragraph [ref=f1e69]: Everything you need for a small team or solo professional.
          - button "Get Starter" [ref=f1e71] [cursor=pointer]
          - list [ref=f1e74]:
            - listitem [ref=f1e75]: CRM (contacts, companies, deals)
            - listitem [ref=f1e79]: Tasks & Projects
            - listitem [ref=f1e83]: Team Chat
            - listitem [ref=f1e87]: Meetings & Calendar
            - listitem [ref=f1e91]: File Storage (10 GB)
            - listitem [ref=f1e95]: AI Assistant (200 req/mo)
            - listitem [ref=f1e99]: Up to 20 members
            - listitem [ref=f1e103]: Priority Support
            - listitem [ref=f1e107]: Advanced Analytics
        - generic [ref=f1e111]:
          - generic [ref=f1e112]: Most Popular
          - generic [ref=f1e113]:
            - paragraph [ref=f1e114]: Pro
            - generic [ref=f1e115]:
              - generic [ref=f1e116]: $19
              - generic [ref=f1e117]: /month
            - paragraph [ref=f1e118]: All features, unlimited members, priority support.
          - button "Get Pro" [ref=f1e120] [cursor=pointer]
          - list [ref=f1e123]:
            - listitem [ref=f1e124]: CRM (contacts, companies, deals)
            - listitem [ref=f1e128]: Tasks & Projects
            - listitem [ref=f1e132]: Team Chat
            - listitem [ref=f1e136]: Meetings & Calendar
            - listitem [ref=f1e140]: File Storage (100 GB)
            - listitem [ref=f1e144]: AI Assistant (unlimited)
            - listitem [ref=f1e148]: Unlimited members
            - listitem [ref=f1e152]: Priority Support
            - listitem [ref=f1e156]: Advanced Analytics
      - generic [ref=f1e160]:
        - heading "Everything in one connected workspace" [level=2] [ref=f1e161]
        - generic [ref=f1e162]:
          - generic [ref=f1e163]:
            - paragraph [ref=f1e169]: CRM & Pipeline
            - paragraph [ref=f1e170]: Contacts, companies, deals
          - generic [ref=f1e171]:
            - paragraph [ref=f1e178]: Team Management
            - paragraph [ref=f1e179]: Roles, workload, presence
          - generic [ref=f1e180]:
            - paragraph [ref=f1e184]: Team Chat
            - paragraph [ref=f1e185]: Channels, DMs, threads
          - generic [ref=f1e186]:
            - paragraph [ref=f1e191]: Projects & Tasks
            - paragraph [ref=f1e192]: Kanban, milestones, tracking
          - generic [ref=f1e193]:
            - paragraph [ref=f1e197]: Calendar & Meetings
            - paragraph [ref=f1e198]: Scheduling, video, notes
          - generic [ref=f1e199]:
            - paragraph [ref=f1e204]: Tavro AI
            - paragraph [ref=f1e205]: Smart summaries & actions
          - generic [ref=f1e206]:
            - paragraph [ref=f1e210]: Security & RBAC
            - paragraph [ref=f1e211]: Roles, audit logs, MFA
          - generic [ref=f1e212]:
            - paragraph [ref=f1e216]: Real-time Updates
            - paragraph [ref=f1e217]: Live sync across your team
      - generic [ref=f1e218]:
        - heading "Frequently asked questions" [level=2] [ref=f1e219]
        - generic [ref=f1e220]:
          - button "Does the free trial require a credit card?" [ref=f1e222] [cursor=pointer]
          - button "What happens when my trial expires?" [ref=f1e226] [cursor=pointer]
          - button "Can I upgrade or downgrade at any time?" [ref=f1e230] [cursor=pointer]
          - button "How do I cancel my subscription?" [ref=f1e234] [cursor=pointer]
          - button "Is my payment information secure?" [ref=f1e238] [cursor=pointer]
          - button "Can I get a refund?" [ref=f1e242] [cursor=pointer]
      - generic [ref=f1e245]:
        - paragraph [ref=f1e246]: Still have questions?
        - link "Contact our team" [ref=f1e247] [cursor=pointer]:
          - /url: /contact
  - alert [ref=f1e250]
```

# Test source

```ts
  155 |       .filter((src) => {
  156 |         try {
  157 |           return new URL(src).origin === location.origin;
  158 |         } catch {
  159 |           return false;
  160 |         }
  161 |       }))]
  162 |   );
  163 |   const secretMarkers: string[] = [];
  164 |   for (const src of scripts) {
  165 |     try {
  166 |       const scriptResponse = await page.request.get(src, { timeout: 10_000 });
  167 |       const scriptText = await scriptResponse.text();
  168 |       const marker = scriptText.match(
  169 |         /(?:sk_(?:live|test)_[A-Za-z0-9]{16,}|AIza[0-9A-Za-z_-]{30,}|-----BEGIN (?:RSA |EC )?PRIVATE KEY-----|mongodb(?:\+srv)?:\/\/[^\s"'<>]{10,})/
  170 |       );
  171 |       if (marker) secretMarkers.push(`${safeUrl(src)} (${marker[0].startsWith('mongodb') ? 'database URI' : 'key/token marker'})`);
  172 |     } catch {
  173 |       // The browser network audit records failed resource requests separately.
  174 |     }
  175 |   }
  176 |   const unlabeledButtons = await page.locator('button').evaluateAll((buttons) =>
  177 |     buttons
  178 |       .filter((button) => {
  179 |         const hasName =
  180 |           button.textContent?.trim() ||
  181 |           button.getAttribute('aria-label') ||
  182 |           button.getAttribute('title') ||
  183 |           button.querySelector('img[alt], svg[aria-label], [aria-labelledby]');
  184 |         return !hasName;
  185 |       })
  186 |       .map((button) => button.outerHTML.slice(0, 240))
  187 |   );
  188 |   const oldBrandMatches = pageText
  189 |     .split(/\r?\n/)
  190 |     .map((line) => line.trim())
  191 |     .filter((line) => oldBrandPattern.test(line))
  192 |     .map((line) => safeText(line).slice(0, 240));
  193 | 
  194 |   return {
  195 |     response,
  196 |     elapsedMs,
  197 |     status: response?.status() ?? null,
  198 |     securityHeaders: response ? await response.allHeaders() : {},
  199 |     title,
  200 |     pageText,
  201 |     imageFailures,
  202 |     overflow,
  203 |     emptyLinks,
  204 |     brokenInternalLinks,
  205 |     secretMarkers,
  206 |     unlabeledButtons,
  207 |     oldBrandMatches,
  208 |     runtimeIssues: runtime.issues,
  209 |     stopTracking: runtime.stop,
  210 |   };
  211 | }
  212 | 
  213 | test.describe('WorkGrind public-site audit', () => {
  214 |   for (const path of publicPaths) {
  215 |     test(`public page ${path}`, async ({ page }) => {
  216 |       const audit = await inspectPage(page, path);
  217 |       expect(audit.response, `${path} navigation returned no HTTP response`).not.toBeNull();
  218 |       expect(audit.response!.status(), `${path} navigation status`).toBeLessThan(400);
  219 |       expect(audit.title, `${path} should have a document title`).toBeTruthy();
  220 |       expect(audit.pageText.trim().length, `${path} should render visible content`).toBeGreaterThan(20);
  221 |       const issues = [
  222 |         ...audit.imageFailures.map((item) => `Broken image: ${item}`),
  223 |         ...(audit.overflow.scrollWidth > audit.overflow.clientWidth + 2
  224 |           ? [`Horizontal overflow: ${audit.overflow.scrollWidth}px content / ${audit.overflow.clientWidth}px viewport`]
  225 |           : []),
  226 |         ...audit.emptyLinks.map((item) => `Link without destination: ${item}`),
  227 |         ...audit.brokenInternalLinks.map((item) => `Broken internal link: ${item}`),
  228 |         ...audit.secretMarkers.map((item) => `Potential secret exposed in client bundle: ${item}`),
  229 |         ...audit.unlabeledButtons.map((item) => `Button without accessible name: ${safeText(item)}`),
  230 |         ...audit.oldBrandMatches.map((item) => `Old-brand text: ${item}`),
  231 |         ...audit.runtimeIssues,
  232 |       ];
  233 |       await test.info().attach('page-audit.json', {
  234 |         body: JSON.stringify({
  235 |           url: safeUrl(page.url()),
  236 |           path,
  237 |           status: audit.status,
  238 |           contentSecurityPolicy: Boolean(audit.securityHeaders['content-security-policy']),
  239 |           strictTransportSecurity: Boolean(audit.securityHeaders['strict-transport-security']),
  240 |           setCookieAttributes: (audit.securityHeaders['set-cookie'] || '')
  241 |             .split(/,(?=[^;]+=[^;]+)/)
  242 |             .filter(Boolean)
  243 |             .map((cookie) => ({
  244 |               secure: /;\s*secure\b/i.test(cookie),
  245 |               httpOnly: /;\s*httponly\b/i.test(cookie),
  246 |               sameSite: cookie.match(/;\s*samesite=([^;]+)/i)?.[1] || null,
  247 |             })),
  248 |           title: safeText(audit.title),
  249 |           elapsedMs: audit.elapsedMs,
  250 |           issues,
  251 |           oldBrandMatches: audit.oldBrandMatches,
  252 |         }, null, 2),
  253 |         contentType: 'application/json',
  254 |       });
> 255 |       expect(issues, `${path} audit issues`).toEqual([]);
      |                                              ^ Error: /pricing audit issues
  256 |       test.info().annotations.push({ type: 'navigation-ms', description: String(audit.elapsedMs) });
  257 |       audit.stopTracking();
  258 |     });
  259 |   }
  260 | });
  261 | 
  262 | test('responsive layouts on key public pages', async ({ page }) => {
  263 |   const issues: string[] = [];
  264 |   for (const viewport of [
  265 |     { name: 'desktop', width: 1440, height: 900 },
  266 |     { name: 'laptop', width: 1280, height: 720 },
  267 |     { name: 'tablet', width: 768, height: 1024 },
  268 |     { name: 'mobile', width: 390, height: 844 },
  269 |   ]) {
  270 |     await page.setViewportSize({ width: viewport.width, height: viewport.height });
  271 |     for (const path of ['/', '/pricing', '/signup', '/login']) {
  272 |       try {
  273 |         await page.goto(path, { waitUntil: 'domcontentloaded' });
  274 |         const sizes = await page.evaluate(() => ({
  275 |           body: document.body.scrollWidth,
  276 |           viewport: document.documentElement.clientWidth,
  277 |         }));
  278 |         if (sizes.body > sizes.viewport + 2) {
  279 |           issues.push(`${viewport.name} ${path}: ${sizes.body}px content exceeds ${sizes.viewport}px viewport`);
  280 |         }
  281 |       } catch (error) {
  282 |         issues.push(`${viewport.name} ${path}: ${error instanceof Error ? error.message : 'navigation failed'}`);
  283 |       }
  284 |     }
  285 |   }
  286 |   await test.info().attach('responsive-audit.json', {
  287 |     body: JSON.stringify({ issues }, null, 2),
  288 |     contentType: 'application/json',
  289 |   });
  290 |   expect(issues).toEqual([]);
  291 | });
  292 | 
  293 | test('login form exposes required email/password fields and blocks empty submission', async ({ page }) => {
  294 |   await page.goto('/login', { waitUntil: 'domcontentloaded' });
  295 |   const email = page.locator('input[type="email"]');
  296 |   const password = page.locator('input[type="password"]');
  297 |   await expect(email).toHaveCount(1);
  298 |   await expect(password).toHaveCount(1);
  299 |   await expect(page.locator('button[type="submit"]')).toHaveCount(1);
  300 |   expect(await email.evaluate((input: HTMLInputElement) => input.required)).toBe(true);
  301 |   expect(await password.evaluate((input: HTMLInputElement) => input.required)).toBe(true);
  302 |   await page.locator('button[type="submit"]').click();
  303 |   expect(await email.evaluate((input: HTMLInputElement) => input.validity.valueMissing)).toBe(true);
  304 |   expect(new URL(page.url()).pathname).toBe('/login');
  305 | });
  306 | 
  307 | test('protected application routes redirect unauthenticated visitors', async ({ page }) => {
  308 |   const results: Array<{ path: string; status: number | null; landedAt: string }> = [];
  309 |   const issues: string[] = [];
  310 |   for (const path of authenticatedPaths) {
  311 |     try {
  312 |       const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
  313 |       await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);
  314 |       const landedAt = new URL(page.url()).pathname;
  315 |       results.push({ path, status: response?.status() ?? null, landedAt });
  316 |       if (!/\/login\/?$/.test(landedAt)) issues.push(`${path} resolved to ${landedAt}, not login`);
  317 |     } catch (error) {
  318 |       issues.push(`${path}: ${error instanceof Error ? safeText(error.message) : 'navigation failed'}`);
  319 |       results.push({ path, status: null, landedAt: safeUrl(page.url()) });
  320 |     }
  321 |   }
  322 |   await test.info().attach('protected-route-audit.json', {
  323 |     body: JSON.stringify({ results, issues }, null, 2),
  324 |     contentType: 'application/json',
  325 |   });
  326 |   expect(issues).toEqual([]);
  327 | });
  328 | 
  329 | test('authenticated routes and read-only feature audit', async ({ page }) => {
  330 |   const email = process.env.WORKGRIND_TEST_EMAIL;
  331 |   const password = process.env.WORKGRIND_TEST_PASSWORD;
  332 |   test.skip(!email || !password, 'Set WORKGRIND_TEST_EMAIL and WORKGRIND_TEST_PASSWORD in the environment to run authenticated checks.');
  333 | 
  334 |   const loginRuntime = trackRuntime(page);
  335 |   await page.goto('/login', { waitUntil: 'domcontentloaded' });
  336 |   await page.locator('input[type="email"]').fill(email!);
  337 |   await page.locator('input[type="password"]').fill(password!);
  338 |   await page.locator('button[type="submit"]').click();
  339 |   await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 30_000 });
  340 | 
  341 |   const storageState = await page.evaluate(() =>
  342 |     Object.keys(localStorage).map((name) => name.toLowerCase())
  343 |   );
  344 |   const cookies = await page.context().cookies();
  345 |   const authEvidence = {
  346 |     redirectedTo: safeUrl(page.url()),
  347 |     storageKeyNames: storageState.filter((name) => /auth|token|session/.test(name)),
  348 |     cookies: cookies
  349 |       .filter((cookie) => /auth|token|session/i.test(cookie.name))
  350 |       .map(({ name, secure, httpOnly, sameSite }) => ({ name, secure, httpOnly, sameSite })),
  351 |   };
  352 |   test.info().annotations.push({
  353 |     type: 'session-evidence',
  354 |     description: JSON.stringify(authEvidence),
  355 |   });
```