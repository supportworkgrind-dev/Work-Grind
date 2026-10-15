# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: workgrind-audit.spec.ts >> WorkGrind public-site audit >> public page /features
- Location: tests\workgrind-audit.spec.ts:218:9

# Error details

```
Error: /features audit issues

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
          - button "Select language" [ref=e15] [cursor=pointer]:
            - generic [ref=e19]: English
          - link "Sign In" [ref=e22] [cursor=pointer]:
            - /url: /login
          - link "Get Started" [ref=e23] [cursor=pointer]:
            - /url: /signup
    - main [ref=e24]:
      - generic [ref=e27]:
        - paragraph [ref=e28]: Features overview
        - heading "A workspace built around the real work." [level=1] [ref=e31]
        - paragraph [ref=e32]: WorkGrind offers separate experiences for personal productivity, company operations, and academic administration. Features depend on workspace type, role, and plan.
        - generic [ref=e33]:
          - link "Get Started" [ref=e34] [cursor=pointer]:
            - /url: /signup
          - link "See How It Works" [ref=e37] [cursor=pointer]:
            - /url: /how-it-works
      - generic [ref=e41]:
        - generic [ref=e43]:
          - paragraph [ref=e44]: Solo, Company, and office capabilities
          - heading "Personal work, team collaboration, and business operations" [level=2] [ref=e45]
          - paragraph [ref=e46]: WorkGrind brings chat, meetings, tasks, projects, CRM, client portal, documents, files, workflows, and analytics into a connected workspace where enabled. Access depends on workspace, role, and plan.
        - generic [ref=e48]:
          - link "Workspace Overview A team-wide snapshot of activity, tasks, projects, CRM signals, and upcoming priorities." [ref=e50] [cursor=pointer]:
            - /url: /dashboard
            - generic [ref=e51]: Workspace
            - generic [ref=e59]: Overview
            - generic [ref=e62]: A team-wide snapshot of activity, tasks, projects, CRM signals, and upcoming priorities.
          - link "Planning Daily Focus Keep today’s priorities, assigned work, deadlines, and meetings in one personal view." [ref=e64] [cursor=pointer]:
            - /url: /daily-focus
            - generic [ref=e65]: Planning
            - generic [ref=e71]: Daily Focus
            - generic [ref=e74]: Keep today’s priorities, assigned work, deadlines, and meetings in one personal view.
          - link "Execution Tasks Create work, assign owners, set due dates, track status, and move priorities forward." [ref=e76] [cursor=pointer]:
            - /url: /tasks
            - generic [ref=e77]: Execution
            - generic [ref=e83]: Tasks
            - generic [ref=e86]: Create work, assign owners, set due dates, track status, and move priorities forward.
          - link "Delivery Projects Organize related work into projects with clear ownership, progress, and deadlines." [ref=e88] [cursor=pointer]:
            - /url: /projects
            - generic [ref=e89]: Delivery
            - generic [ref=e96]: Projects
            - generic [ref=e99]: Organize related work into projects with clear ownership, progress, and deadlines.
          - link "Scheduling Calendar See meetings, due dates, and time-sensitive work in one shared schedule." [ref=e101] [cursor=pointer]:
            - /url: /calendar
            - generic [ref=e102]: Scheduling
            - generic [ref=e107]: Calendar
            - generic [ref=e110]: See meetings, due dates, and time-sensitive work in one shared schedule.
          - link "Customers CRM Keep companies, contacts, deals, and customer context attached to the work." [ref=e112] [cursor=pointer]:
            - /url: /crm
            - generic [ref=e113]: Customers
            - generic [ref=e121]: CRM
            - generic [ref=e124]: Keep companies, contacts, deals, and customer context attached to the work.
      - generic [ref=e126]:
        - generic [ref=e128]:
          - paragraph [ref=e129]: Collaboration
          - heading "Keep conversations, knowledge, and files close to the work" [level=2] [ref=e130]
          - paragraph [ref=e131]: WorkGrind gives teams the communication and document systems they need to plan, align, and move work forward together.
        - generic [ref=e133]:
          - link "Communication Chat Use team channels and direct conversations to keep context close to the work." [ref=e135] [cursor=pointer]:
            - /url: /chat
            - generic [ref=e136]: Communication
            - generic [ref=e141]: Chat
            - generic [ref=e144]: Use team channels and direct conversations to keep context close to the work.
          - link "Meetings Meetings Schedule meetings, review notes, and capture action items tied to follow-up work." [ref=e146] [cursor=pointer]:
            - /url: /meetings
            - generic [ref=e147]: Meetings
            - generic [ref=e155]: Meetings
            - generic [ref=e158]: Schedule meetings, review notes, and capture action items tied to follow-up work.
          - link "Planning Whiteboard Visualize ideas, planning, and team thinking in a collaborative board space." [ref=e160] [cursor=pointer]:
            - /url: /whiteboard
            - generic [ref=e161]: Planning
            - generic [ref=e166]: Whiteboard
            - generic [ref=e169]: Visualize ideas, planning, and team thinking in a collaborative board space.
          - link "Knowledge Docs Create and organize shared documents that keep team knowledge in one place." [ref=e171] [cursor=pointer]:
            - /url: /docs
            - generic [ref=e172]: Knowledge
            - generic [ref=e177]: Docs
            - generic [ref=e180]: Create and organize shared documents that keep team knowledge in one place.
          - link "Content Files Organize workspace files with folders, previews, and search for the documents teams use every day." [ref=e182] [cursor=pointer]:
            - /url: /files
            - generic [ref=e183]: Content
            - generic [ref=e188]: Files
            - generic [ref=e191]: Organize workspace files with folders, previews, and search for the documents teams use every day.
          - link "Signals Notifications Review updates, stay on top of assigned work, and move from alert to action quickly." [ref=e193] [cursor=pointer]:
            - /url: /notifications
            - generic [ref=e194]: Signals
            - generic [ref=e200]: Notifications
            - generic [ref=e203]: Review updates, stay on top of assigned work, and move from alert to action quickly.
      - generic [ref=e205]:
        - generic [ref=e207]:
          - paragraph [ref=e208]: Operations
          - heading "Automation, analytics, and intelligent support" [level=2] [ref=e209]
          - paragraph [ref=e210]: "The workspace does more than track work: it helps teams understand activity, automate routine steps, and use supported AI tools with the right permissions."
        - generic [ref=e212]:
          - link "Insights Analytics Review task, project, CRM, and workspace activity to understand what is moving and what needs attention." [ref=e214] [cursor=pointer]:
            - /url: /analytics
            - generic [ref=e215]: Insights
            - generic [ref=e220]: Analytics
            - generic [ref=e223]: Review task, project, CRM, and workspace activity to understand what is moving and what needs attention.
          - link "Automation Automation Use supported triggers and configured actions for task creation, alerts, and channel updates." [ref=e225] [cursor=pointer]:
            - /url: /workflows
            - generic [ref=e226]: Automation
            - generic [ref=e233]: Automation
            - generic [ref=e236]: Use supported triggers and configured actions for task creation, alerts, and channel updates.
          - link "AI Tavro AI Get assistance with supported work and learning information in your workspace. Available data and actions depend on workspace, role, and plan." [ref=e238] [cursor=pointer]:
            - /url: /ai
            - generic [ref=e239]: AI
            - generic [ref=e245]: Tavro AI
            - generic [ref=e248]: Get assistance with supported work and learning information in your workspace. Available data and actions depend on workspace, role, and plan.
          - link "External access Client Portal Give clients a separate, permission-scoped place for shared project updates, messages, and approvals." [ref=e250] [cursor=pointer]:
            - /url: /client-portal
            - generic [ref=e251]: External access
            - generic [ref=e257]: Client Portal
            - generic [ref=e260]: Give clients a separate, permission-scoped place for shared project updates, messages, and approvals.
          - link "Access Team Manage people, roles, and the shared operational context behind the workspace." [ref=e262] [cursor=pointer]:
            - /url: /team
            - generic [ref=e263]: Access
            - generic [ref=e271]: Team
            - generic [ref=e274]: Manage people, roles, and the shared operational context behind the workspace.
          - link "Admin Settings Adjust personal and workspace preferences so the system matches how your team works." [ref=e276] [cursor=pointer]:
            - /url: /settings
            - generic [ref=e277]: Admin
            - generic [ref=e283]: Settings
            - generic [ref=e286]: Adjust personal and workspace preferences so the system matches how your team works.
      - generic [ref=e288]:
        - generic [ref=e290]:
          - paragraph [ref=e291]: Company capabilities
          - heading "Business tools for company workspaces" [level=2] [ref=e292]
          - paragraph [ref=e293]: CRM, Client Portal, and business integrations are company-oriented capabilities. Their availability depends on the workspace role and plan.
        - generic [ref=e295]:
          - link "Global voice Global Calling Use a WorkGrind Calling ID to reach any eligible user worldwide with secure audio and permission-aware call discovery." [ref=e297] [cursor=pointer]:
            - /url: /calling
            - generic [ref=e298]: Global voice
            - generic [ref=e303]: Global Calling
            - generic [ref=e306]: Use a WorkGrind Calling ID to reach any eligible user worldwide with secure audio and permission-aware call discovery.
          - link "Versioned API Connect API Connect a company website or application to scoped Contacts, CRM Companies, Deals, Projects, Tasks, and read-only Team endpoints." [ref=e308] [cursor=pointer]:
            - /url: /developer/docs
            - generic [ref=e309]: Versioned API
            - generic [ref=e316]: Connect API
            - generic [ref=e319]: Connect a company website or application to scoped Contacts, CRM Companies, Deals, Projects, Tasks, and read-only Team endpoints.
          - link "Developer access API Keys Owners and admins can create scoped read/write keys, see each secret once, then rotate or revoke access." [ref=e321] [cursor=pointer]:
            - /url: /developer
            - generic [ref=e322]: Developer access
            - generic [ref=e328]: API Keys
            - generic [ref=e331]: Owners and admins can create scoped read/write keys, see each secret once, then rotate or revoke access.
          - link "Delivery coming soon Webhooks Save HTTPS endpoints and event labels for a workspace. External event delivery is Coming Soon." [ref=e333] [cursor=pointer]:
            - /url: /developer
            - generic [ref=e334]: Delivery coming soon
            - generic [ref=e341]: Webhooks
            - generic [ref=e344]: Save HTTPS endpoints and event labels for a workspace. External event delivery is Coming Soon.
          - link "Scoped connectivity External websites & apps Use the Connect API from a trusted server to read or update the WorkGrind resources allowed by its key scopes." [ref=e346] [cursor=pointer]:
            - /url: /how-it-works#connect-api
            - generic [ref=e347]: Scoped connectivity
            - generic [ref=e355]: External websites & apps
            - generic [ref=e358]: Use the Connect API from a trusted server to read or update the WorkGrind resources allowed by its key scopes.
      - generic [ref=e360]:
        - generic [ref=e362]:
          - paragraph [ref=e363]: Choose a workspace
          - heading "Different needs, distinct experiences" [level=2] [ref=e364]
          - paragraph [ref=e365]: Choose an account type during signup. Available features depend on the persisted workspace type, your role, and plan.
        - generic [ref=e366]:
          - link "Solo Personal productivity, daily planning, tasks, projects, documents, and Tavro AI assistance where available." [ref=e367] [cursor=pointer]:
            - /url: /signup?workspace=solo
            - generic [ref=e368]: Solo
            - generic [ref=e371]: Personal productivity, daily planning, tasks, projects, documents, and Tavro AI assistance where available.
          - link "Company Office and business teams can use chat, meetings, tasks, projects, CRM, client portal, documents, files, workflows, and analytics where available." [ref=e372] [cursor=pointer]:
            - /url: /signup?workspace=business
            - generic [ref=e373]: Company
            - generic [ref=e376]: Office and business teams can use chat, meetings, tasks, projects, CRM, client portal, documents, files, workflows, and analytics where available.
          - link "School / Academy Support administrators, teachers, and students with classes, courses, timetables, attendance, assignments, online class meetings where enabled, exams, results, fee records, and communication." [ref=e377] [cursor=pointer]:
            - /url: /signup?workspace=school
            - generic [ref=e378]: School / Academy
            - generic [ref=e381]: Support administrators, teachers, and students with classes, courses, timetables, attendance, assignments, online class meetings where enabled, exams, results, fee records, and communication.
          - link "College Coordinate students, faculty, departments, courses, schedules, attendance, assignments, online meetings where enabled, assessments, results, fee records, and communication." [ref=e382] [cursor=pointer]:
            - /url: /signup?workspace=college
            - generic [ref=e383]: College
            - generic [ref=e386]: Coordinate students, faculty, departments, courses, schedules, attendance, assignments, online meetings where enabled, assessments, results, fee records, and communication.
          - link "University Support students, faculty, administrators, departments, courses, timetables, attendance, online meetings where enabled, assessments, results, fee records, and communication." [ref=e387] [cursor=pointer]:
            - /url: /signup?workspace=university
            - generic [ref=e388]: University
            - generic [ref=e391]: Support students, faculty, administrators, departments, courses, timetables, attendance, online meetings where enabled, assessments, results, fee records, and communication.
      - generic [ref=e393]:
        - generic [ref=e395]:
          - paragraph [ref=e396]: Administration
          - heading "Keep the workspace healthy and govern access" [level=2] [ref=e397]
          - paragraph [ref=e398]: The admin side helps teams manage roles, billing, preferences, and the operational infrastructure behind the workspace.
        - generic [ref=e400]:
          - link "Plan Billing Review plan details and subscription information from the workspace admin side." [ref=e402] [cursor=pointer]:
            - /url: /billing
            - generic [ref=e403]: Plan
            - generic [ref=e409]: Billing
            - generic [ref=e412]: Review plan details and subscription information from the workspace admin side.
          - link "Knowledge Files + Docs Keep shared, client-facing, and internal documents in the same operating system." [ref=e414] [cursor=pointer]:
            - /url: /files
            - generic [ref=e415]: Knowledge
            - generic [ref=e421]: Files + Docs
            - generic [ref=e424]: Keep shared, client-facing, and internal documents in the same operating system.
      - generic [ref=e427]:
        - paragraph [ref=e428]: WorkGrind workspaces
        - heading "Start with the workspace that fits your work." [level=2] [ref=e429]
        - paragraph [ref=e430]: Choose Solo, Company, School / Academy, College, or University during signup.
        - generic [ref=e431]:
          - link "Get Started" [ref=e432] [cursor=pointer]:
            - /url: /signup
          - link "Learn the workflow" [ref=e435] [cursor=pointer]:
            - /url: /how-it-works
    - contentinfo [ref=e438]:
      - generic [ref=e439]:
        - generic [ref=e440]:
          - generic [ref=e441]:
            - img "WorkGrind" [ref=e442]:
              - generic [aria-hidden] [ref=e446]:
                - generic [ref=e447]: Work
                - generic [ref=e448]: Grind
            - paragraph [ref=e449]: A connected workspace for personal work, business, and education.
            - link "Follow WorkGrind on Instagram" [ref=e451] [cursor=pointer]:
              - /url: https://www.instagram.com/workgrind2026?utm_source=qr&stkn=NTJ5MHNuNWJ3bjJp
          - generic [ref=e456]:
            - heading "Company" [level=3] [ref=e457]
            - list [ref=e458]:
              - listitem [ref=e459]:
                - link "About" [ref=e460] [cursor=pointer]:
                  - /url: /about
              - listitem [ref=e461]:
                - link "Features" [ref=e462] [cursor=pointer]:
                  - /url: /features
              - listitem [ref=e463]:
                - link "Demo" [ref=e464] [cursor=pointer]:
                  - /url: /demo
              - listitem [ref=e465]:
                - link "Contact" [ref=e466] [cursor=pointer]:
                  - /url: /contact
          - generic [ref=e467]:
            - heading "Legal" [level=3] [ref=e468]
            - list [ref=e469]:
              - listitem [ref=e470]:
                - link "Privacy Policy" [ref=e471] [cursor=pointer]:
                  - /url: /privacy
              - listitem [ref=e472]:
                - link "Terms of Service" [ref=e473] [cursor=pointer]:
                  - /url: /terms
              - listitem [ref=e474]:
                - link "Cookie Preferences" [ref=e475] [cursor=pointer]:
                  - /url: /cookies
              - listitem [ref=e476]:
                - link "Refund Policy" [ref=e477] [cursor=pointer]:
                  - /url: /refunds
              - listitem [ref=e478]:
                - link "Cancellation Policy" [ref=e479] [cursor=pointer]:
                  - /url: /cancellation
              - listitem [ref=e480]:
                - link "Disclaimer" [ref=e481] [cursor=pointer]:
                  - /url: /disclaimer
          - generic [ref=e482]:
            - heading "Trust & Security" [level=3] [ref=e483]
            - list [ref=e484]:
              - listitem [ref=e485]:
                - link "Security" [ref=e486] [cursor=pointer]:
                  - /url: /security
              - listitem [ref=e487]:
                - link "Responsible Disclosure" [ref=e488] [cursor=pointer]:
                  - /url: /responsible-disclosure
              - listitem [ref=e489]:
                - link "Accessibility" [ref=e490] [cursor=pointer]:
                  - /url: /accessibility
              - listitem [ref=e491]:
                - link "Data Processing Agreement" [ref=e492] [cursor=pointer]:
                  - /url: /dpa
              - listitem [ref=e493]:
                - link "Acceptable Use" [ref=e494] [cursor=pointer]:
                  - /url: /acceptable-use
              - listitem [ref=e495]:
                - link "Community Guidelines" [ref=e496] [cursor=pointer]:
                  - /url: /community-guidelines
          - generic [ref=e497]:
            - heading "Support" [level=3] [ref=e498]
            - list [ref=e499]:
              - listitem [ref=e500]:
                - link "Help Center" [ref=e501] [cursor=pointer]:
                  - /url: /help
              - listitem [ref=e502]:
                - link "Support" [ref=e503] [cursor=pointer]:
                  - /url: /support
        - generic [ref=e504]:
          - paragraph [ref=e505]: © 2026 WorkGrind. All rights reserved.
          - button "Select language" [ref=e507] [cursor=pointer]:
            - generic [ref=e511]: English
  - alert [ref=e514]
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
      |                                              ^ Error: /features audit issues
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