# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: workgrind-audit.spec.ts >> WorkGrind public-site audit >> public page /login
- Location: tests\workgrind-audit.spec.ts:218:9

# Error details

```
Error: /login audit issues

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 4

- Array []
+ Array [
+   "401 POST http://localhost:3000/api/auth/refresh",
+   "Console error: Failed to load resource: the server responded with a status of 401 (Unauthorized)",
+ ]
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - main [ref=e2]:
    - complementary "WorkGrind workspace preview" [ref=e3]:
      - generic [ref=e4]:
        - img "WorkGrind" [ref=e5]:
          - generic [aria-hidden] [ref=e9]:
            - generic [ref=e10]: Work
            - generic [ref=e11]: Grind
        - generic [ref=e12]: WORK, IN GOOD ORDER.
      - generic [ref=e13]:
        - paragraph [ref=e14]: FOR WORK, BUSINESS, AND LEARNING
        - heading "One workspace for work and learning." [level=2] [ref=e15]: One workspacefor work and learning.
        - paragraph [ref=e16]: Personal planning, team collaboration, and academic administration, with Tavro AI for work and learning where available.
      - generic "Illustration of a WorkGrind workspace" [ref=e17]:
        - generic [ref=e18]:
          - generic [ref=e19]: MONDAY / OVERVIEW
          - generic [ref=e20]: SAMPLE
        - generic [ref=e22]: Good morning, team.
        - generic [ref=e24]:
          - generic [ref=e28]:
            - strong [ref=e29]: Launch planning
            - generic [ref=e30]: Product / Due today
          - generic [ref=e31]: AM
        - generic [ref=e32]:
          - generic [ref=e36]:
            - strong [ref=e37]: Review Q3 pipeline
            - generic [ref=e38]: Sales / In progress
          - generic [ref=e39]: JL
        - generic [ref=e40]:
          - generic [ref=e41]: FOCUS BLOCK
          - strong [ref=e45]: 2h 40m
      - paragraph [ref=e49]: For individuals, organizations, and education teams.
    - generic [ref=e50]:
      - generic [ref=e51]:
        - paragraph [ref=e52]: YOUR WORKSPACE AWAITS
        - heading "Good to have you back." [level=1] [ref=e53]
        - paragraph [ref=e54]: Sign in to continue in your WorkGrind workspace.
        - generic [ref=e56]:
          - button "Continue with Google" [ref=e57] [cursor=pointer]
          - button "Continue with LinkedIn" [ref=e63] [cursor=pointer]
        - generic [ref=e66]: or sign in with email
        - generic [ref=e69]:
          - generic [ref=e70]:
            - generic [ref=e71]: Email address
            - textbox "Email address" [ref=e73]:
              - /placeholder: you@example.com
          - generic [ref=e74]:
            - generic [ref=e75]:
              - generic [ref=e76]: Password
              - link "Forgot password?" [ref=e77] [cursor=pointer]:
                - /url: /forgot-password
            - generic [ref=e78]:
              - textbox "Password" [ref=e79]:
                - /placeholder: Your password
              - button "Show password" [ref=e80] [cursor=pointer]
          - button "Sign in to WorkGrind" [ref=e84] [cursor=pointer]
        - generic [ref=e87]:
          - paragraph [ref=e88]: Demo access
          - generic [ref=e89]:
            - button "Sarah · Owner" [ref=e90] [cursor=pointer]
            - button "Alex · Admin" [ref=e91] [cursor=pointer]
        - paragraph [ref=e92]:
          - text: New to WorkGrind?
          - link "Choose a workspace and get started" [ref=e93] [cursor=pointer]:
            - /url: /signup
        - paragraph [ref=e94]: Protected sign-in · Workspace access is role-based
      - generic [ref=e95]:
        - generic [ref=e96]: © 2026 WorkGrind
        - generic [ref=e97]: For individuals, businesses, and education teams.
  - alert [ref=e98]
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
      |                                              ^ Error: /login audit issues
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