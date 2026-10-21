# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: workgrind-audit.spec.ts >> WorkGrind public-site audit >> public page /privacy
- Location: tests\workgrind-audit.spec.ts:218:9

# Error details

```
Error: /privacy audit issues

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
    - banner [ref=e3]:
      - generic [ref=e4]:
        - link "WorkGrind home" [ref=e5] [cursor=pointer]:
          - /url: /
          - img "WorkGrind" [ref=e6]:
            - generic [aria-hidden] [ref=e10]:
              - generic [ref=e11]: Work
              - generic [ref=e12]: Grind
        - generic [ref=e13]:
          - button "English , select language" [ref=e15] [cursor=pointer]:
            - generic [ref=e19]: English
            - generic [ref=e20]: ", select language"
          - link "Sign In" [ref=e23] [cursor=pointer]:
            - /url: /login
          - link "Get Started" [ref=e24] [cursor=pointer]:
            - /url: /signup
    - main [ref=e25]:
      - article [ref=e26]:
        - generic [ref=e27]:
          - link "WorkGrind" [ref=e28] [cursor=pointer]:
            - /url: /
          - heading "Privacy Policy" [level=1] [ref=e29]
          - paragraph [ref=e30]: This policy describes information WorkGrind processes to provide Solo, Company, and education workspaces and their enabled features.
          - paragraph [ref=e31]: "Last updated: October 5, 2026"
        - generic [ref=e32]:
          - generic [ref=e33]:
            - heading "Information processed" [level=2] [ref=e34]
            - paragraph [ref=e35]: Account information includes the name, email address, password credential, verification state, and profile details you provide. Workspace information includes members, tasks, projects, calendar entries, CRM records, messages, calls and meeting metadata, client portal records, and files you or your workspace members submit.
            - paragraph [ref=e36]: Billing records include the selected plan, subscription state, dates, and payment-provider identifiers received from Polar. WorkGrind does not need your full payment-card number to maintain a subscription record. Contact form submissions include the details and message you submit.
          - generic [ref=e37]:
            - heading "Education workspace information" [level=2] [ref=e38]
            - paragraph [ref=e39]: Depending on the modules an institution uses, workspace content may include student, parent / guardian, teacher or faculty records, classes, courses, assignments, attendance, exams, results, fees, and department information submitted by its members. The institution and its authorized workspace administrators are responsible for determining what information they may submit and share, providing any required notices, and obtaining any required permissions or consents. WorkGrind does not claim a child-specific privacy certification or legal compliance status.
          - generic [ref=e40]:
            - heading "Browser storage" [level=2] [ref=e41]
            - paragraph [ref=e42]: The application stores authentication tokens in session storage for the active browser session. Depending on the feature, it also stores preferences and drafts in local storage, including language, theme, chat sound, PWA prompt state, task views, and locally saved work. A first-party theme preference is also stored in a SameSite=Lax cookie for up to one year so the selected theme can be applied on the next request. See Cookie Preferences for details.
          - generic [ref=e43]:
            - heading "How information is used" [level=2] [ref=e44]
            - paragraph [ref=e45]: Information is used to authenticate accounts, provide workspace features, route messages and calls, store and retrieve files, maintain subscription state, support users who submit inquiries, protect the service, and operate the features a user requests. AI features process the prompts and related context needed to produce a response when those features are used.
          - generic [ref=e46]:
            - heading "Service providers and sharing" [level=2] [ref=e47]
            - paragraph [ref=e48]: WorkGrind uses configured infrastructure and service providers to operate the product. The project integrates MongoDB for application records, Cloudflare R2 when configured for file storage, Polar for subscription checkout and subscription events, configured email delivery, and configured AI providers when an AI feature is used. These providers receive data only as needed for the requested product function. Workspace administrators and collaborators may also see content shared within their workspace or client portal.
          - generic [ref=e49]:
            - heading "Retention and requests" [level=2] [ref=e50]
            - paragraph [ref=e51]: The application does not publish a universal retention period for every record. Some workspace content is retained as needed to provide the service and may remain available to workspace members after a plan changes. To ask about access, correction, or deletion of account or workspace data, submit a request through the contact form. The request may need to be handled by the workspace owner for workspace-managed content.
          - generic [ref=e52]:
            - heading "Security and legal details" [level=2] [ref=e53]
            - paragraph [ref=e54]: WorkGrind uses application authentication and authorization controls described in its Security Policy. This policy does not claim a security certification or a particular legal compliance status. The contracting legal entity, applicable jurisdiction, and any country-specific privacy terms have not been specified in the project and must be supplied in the applicable customer agreement.
        - generic [ref=e55]:
          - text: Questions about this document? Use the WorkGrind
          - link "contact form" [ref=e56] [cursor=pointer]:
            - /url: /contact
          - text: .
    - contentinfo [ref=e57]:
      - generic [ref=e58]:
        - generic [ref=e59]:
          - generic [ref=e60]:
            - img "WorkGrind" [ref=e61]:
              - generic [aria-hidden] [ref=e65]:
                - generic [ref=e66]: Work
                - generic [ref=e67]: Grind
            - paragraph [ref=e68]: A connected workspace for personal work, business, and education.
            - link "Follow WorkGrind on Instagram" [ref=e70] [cursor=pointer]:
              - /url: https://www.instagram.com/workgrind2026?utm_source=qr&stkn=NTJ5MHNuNWJ3bjJp
          - generic [ref=e75]:
            - heading "Company" [level=3] [ref=e76]
            - list [ref=e77]:
              - listitem [ref=e78]:
                - link "About" [ref=e79] [cursor=pointer]:
                  - /url: /about
              - listitem [ref=e80]:
                - link "Features" [ref=e81] [cursor=pointer]:
                  - /url: /features
              - listitem [ref=e82]:
                - link "Demo" [ref=e83] [cursor=pointer]:
                  - /url: /demo
              - listitem [ref=e84]:
                - link "Contact" [ref=e85] [cursor=pointer]:
                  - /url: /contact
          - generic [ref=e86]:
            - heading "Legal" [level=3] [ref=e87]
            - list [ref=e88]:
              - listitem [ref=e89]:
                - link "Privacy Policy" [ref=e90] [cursor=pointer]:
                  - /url: /privacy
              - listitem [ref=e91]:
                - link "Terms of Service" [ref=e92] [cursor=pointer]:
                  - /url: /terms
              - listitem [ref=e93]:
                - link "Cookie Preferences" [ref=e94] [cursor=pointer]:
                  - /url: /cookies
              - listitem [ref=e95]:
                - link "Refund Policy" [ref=e96] [cursor=pointer]:
                  - /url: /refunds
              - listitem [ref=e97]:
                - link "Cancellation Policy" [ref=e98] [cursor=pointer]:
                  - /url: /cancellation
              - listitem [ref=e99]:
                - link "Disclaimer" [ref=e100] [cursor=pointer]:
                  - /url: /disclaimer
          - generic [ref=e101]:
            - heading "Trust & Security" [level=3] [ref=e102]
            - list [ref=e103]:
              - listitem [ref=e104]:
                - link "Security" [ref=e105] [cursor=pointer]:
                  - /url: /security
              - listitem [ref=e106]:
                - link "Responsible Disclosure" [ref=e107] [cursor=pointer]:
                  - /url: /responsible-disclosure
              - listitem [ref=e108]:
                - link "Accessibility" [ref=e109] [cursor=pointer]:
                  - /url: /accessibility
              - listitem [ref=e110]:
                - link "Data Processing Agreement" [ref=e111] [cursor=pointer]:
                  - /url: /dpa
              - listitem [ref=e112]:
                - link "Acceptable Use" [ref=e113] [cursor=pointer]:
                  - /url: /acceptable-use
              - listitem [ref=e114]:
                - link "Community Guidelines" [ref=e115] [cursor=pointer]:
                  - /url: /community-guidelines
          - generic [ref=e116]:
            - heading "Support" [level=3] [ref=e117]
            - list [ref=e118]:
              - listitem [ref=e119]:
                - link "Help Center" [ref=e120] [cursor=pointer]:
                  - /url: /help
              - listitem [ref=e121]:
                - link "Support" [ref=e122] [cursor=pointer]:
                  - /url: /support
        - generic [ref=e123]:
          - paragraph [ref=e124]: © 2026 WorkGrind. All rights reserved.
          - button "English , select language" [ref=e126] [cursor=pointer]:
            - generic [ref=e130]: English
            - generic [ref=e131]: ", select language"
  - alert [ref=e134]
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
      |                                              ^ Error: /privacy audit issues
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