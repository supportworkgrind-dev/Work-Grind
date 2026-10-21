# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: workgrind-audit.spec.ts >> WorkGrind public-site audit >> public page /terms
- Location: tests\workgrind-audit.spec.ts:218:9

# Error details

```
Error: /terms audit issues

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
          - heading "Terms of Service" [level=1] [ref=e29]
          - paragraph [ref=e30]: These terms cover access to WorkGrind Solo, Company, School / Academy, College, and University workspaces and their enabled features.
          - paragraph [ref=e31]: "Last updated: October 5, 2026"
        - generic [ref=e32]:
          - generic [ref=e33]:
            - heading "Accounts and workspaces" [level=2] [ref=e34]
            - paragraph [ref=e35]: Provide accurate account information, keep your sign-in credentials confidential, and promptly report suspected unauthorized access using the contact form. Workspace owners and administrators manage membership, roles, and shared content for their workspace. For education workspaces, the institution is responsible for its authority to submit and share student, guardian, faculty, and academic records and for any notices or permissions required by applicable law. You are responsible for ensuring you have the rights needed to submit content to WorkGrind.
          - generic [ref=e36]:
            - heading "Use of the service" [level=2] [ref=e37]
            - paragraph [ref=e38]: Use WorkGrind only for lawful purposes and in accordance with the Acceptable Use Policy and Community Guidelines. Do not attempt to access another account or workspace without authorization, bypass access controls, disrupt the service, or upload malicious content.
          - generic [ref=e39]:
            - heading "Plans and billing" [level=2] [ref=e40]
            - paragraph [ref=e41]: The available plans and configured storage limits are shown on the pricing and billing pages. New accounts may receive a seven-day trial as described in the product. Paid checkout and subscription state are handled through Polar. Cancellation, plan changes, and refund information are described in the relevant policies and are subject to the checkout terms presented for the transaction.
          - generic [ref=e42]:
            - heading "Content and service operation" [level=2] [ref=e43]
            - paragraph [ref=e44]: You retain responsibility for the content you and your workspace members submit. WorkGrind processes that content to deliver the features you use. Do not use AI-generated content without appropriate review for your intended purpose. The service depends on internet access, configured providers, and ongoing maintenance; no uptime commitment or service-level agreement is stated here.
          - generic [ref=e45]:
            - heading "Changes and legal details" [level=2] [ref=e46]
            - paragraph [ref=e47]: WorkGrind may update the service or these terms. Material changes will be reflected by updating the date on this page. The project does not identify the contracting legal entity or governing-law jurisdiction; these details must be completed in a customer-specific agreement where required. Nothing on this page invents or substitutes for those details.
        - generic [ref=e48]:
          - text: Questions about this document? Use the WorkGrind
          - link "contact form" [ref=e49] [cursor=pointer]:
            - /url: /contact
          - text: .
    - contentinfo [ref=e50]:
      - generic [ref=e51]:
        - generic [ref=e52]:
          - generic [ref=e53]:
            - img "WorkGrind" [ref=e54]:
              - generic [aria-hidden] [ref=e58]:
                - generic [ref=e59]: Work
                - generic [ref=e60]: Grind
            - paragraph [ref=e61]: A connected workspace for personal work, business, and education.
            - link "Follow WorkGrind on Instagram" [ref=e63] [cursor=pointer]:
              - /url: https://www.instagram.com/workgrind2026?utm_source=qr&stkn=NTJ5MHNuNWJ3bjJp
          - generic [ref=e68]:
            - heading "Company" [level=3] [ref=e69]
            - list [ref=e70]:
              - listitem [ref=e71]:
                - link "About" [ref=e72] [cursor=pointer]:
                  - /url: /about
              - listitem [ref=e73]:
                - link "Features" [ref=e74] [cursor=pointer]:
                  - /url: /features
              - listitem [ref=e75]:
                - link "Demo" [ref=e76] [cursor=pointer]:
                  - /url: /demo
              - listitem [ref=e77]:
                - link "Contact" [ref=e78] [cursor=pointer]:
                  - /url: /contact
          - generic [ref=e79]:
            - heading "Legal" [level=3] [ref=e80]
            - list [ref=e81]:
              - listitem [ref=e82]:
                - link "Privacy Policy" [ref=e83] [cursor=pointer]:
                  - /url: /privacy
              - listitem [ref=e84]:
                - link "Terms of Service" [ref=e85] [cursor=pointer]:
                  - /url: /terms
              - listitem [ref=e86]:
                - link "Cookie Preferences" [ref=e87] [cursor=pointer]:
                  - /url: /cookies
              - listitem [ref=e88]:
                - link "Refund Policy" [ref=e89] [cursor=pointer]:
                  - /url: /refunds
              - listitem [ref=e90]:
                - link "Cancellation Policy" [ref=e91] [cursor=pointer]:
                  - /url: /cancellation
              - listitem [ref=e92]:
                - link "Disclaimer" [ref=e93] [cursor=pointer]:
                  - /url: /disclaimer
          - generic [ref=e94]:
            - heading "Trust & Security" [level=3] [ref=e95]
            - list [ref=e96]:
              - listitem [ref=e97]:
                - link "Security" [ref=e98] [cursor=pointer]:
                  - /url: /security
              - listitem [ref=e99]:
                - link "Responsible Disclosure" [ref=e100] [cursor=pointer]:
                  - /url: /responsible-disclosure
              - listitem [ref=e101]:
                - link "Accessibility" [ref=e102] [cursor=pointer]:
                  - /url: /accessibility
              - listitem [ref=e103]:
                - link "Data Processing Agreement" [ref=e104] [cursor=pointer]:
                  - /url: /dpa
              - listitem [ref=e105]:
                - link "Acceptable Use" [ref=e106] [cursor=pointer]:
                  - /url: /acceptable-use
              - listitem [ref=e107]:
                - link "Community Guidelines" [ref=e108] [cursor=pointer]:
                  - /url: /community-guidelines
          - generic [ref=e109]:
            - heading "Support" [level=3] [ref=e110]
            - list [ref=e111]:
              - listitem [ref=e112]:
                - link "Help Center" [ref=e113] [cursor=pointer]:
                  - /url: /help
              - listitem [ref=e114]:
                - link "Support" [ref=e115] [cursor=pointer]:
                  - /url: /support
        - generic [ref=e116]:
          - paragraph [ref=e117]: © 2026 WorkGrind. All rights reserved.
          - button "English , select language" [ref=e119] [cursor=pointer]:
            - generic [ref=e123]: English
            - generic [ref=e124]: ", select language"
  - alert [ref=e127]
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
      |                                              ^ Error: /terms audit issues
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