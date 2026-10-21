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
      - generic [ref=e28]:
        - paragraph [ref=e29]: Features overview
        - heading "A workspace built around the real work." [level=1] [ref=e32]
        - paragraph [ref=e33]: WorkGrind offers separate experiences for personal productivity, company operations, and academic administration. Features depend on workspace type, role, and plan.
        - generic [ref=e34]:
          - link "Get Started" [ref=e35] [cursor=pointer]:
            - /url: /signup
          - link "See How It Works" [ref=e38] [cursor=pointer]:
            - /url: /how-it-works
      - generic [ref=e42]:
        - generic [ref=e44]:
          - paragraph [ref=e45]: Solo, Company, and office capabilities
          - heading "Personal work, team collaboration, and business operations" [level=2] [ref=e46]
          - paragraph [ref=e47]: WorkGrind brings chat, meetings, tasks, projects, CRM, client portal, documents, files, workflows, and analytics into a connected workspace where enabled. Access depends on workspace, role, and plan.
        - generic [ref=e49]:
          - link "Workspace Overview A team-wide snapshot of activity, tasks, projects, CRM signals, and upcoming priorities." [ref=e51] [cursor=pointer]:
            - /url: /dashboard
            - generic [ref=e52]: Workspace
            - generic [ref=e60]: Overview
            - generic [ref=e63]: A team-wide snapshot of activity, tasks, projects, CRM signals, and upcoming priorities.
          - link "Planning Daily Focus Keep today’s priorities, assigned work, deadlines, and meetings in one personal view." [ref=e65] [cursor=pointer]:
            - /url: /daily-focus
            - generic [ref=e66]: Planning
            - generic [ref=e72]: Daily Focus
            - generic [ref=e75]: Keep today’s priorities, assigned work, deadlines, and meetings in one personal view.
          - link "Execution Tasks Create work, assign owners, set due dates, track status, and move priorities forward." [ref=e77] [cursor=pointer]:
            - /url: /tasks
            - generic [ref=e78]: Execution
            - generic [ref=e84]: Tasks
            - generic [ref=e87]: Create work, assign owners, set due dates, track status, and move priorities forward.
          - link "Delivery Projects Organize related work into projects with clear ownership, progress, and deadlines." [ref=e89] [cursor=pointer]:
            - /url: /projects
            - generic [ref=e90]: Delivery
            - generic [ref=e97]: Projects
            - generic [ref=e100]: Organize related work into projects with clear ownership, progress, and deadlines.
          - link "Scheduling Calendar See meetings, due dates, and time-sensitive work in one shared schedule." [ref=e102] [cursor=pointer]:
            - /url: /calendar
            - generic [ref=e103]: Scheduling
            - generic [ref=e108]: Calendar
            - generic [ref=e111]: See meetings, due dates, and time-sensitive work in one shared schedule.
          - link "Customers CRM Keep companies, contacts, deals, and customer context attached to the work." [ref=e113] [cursor=pointer]:
            - /url: /crm
            - generic [ref=e114]: Customers
            - generic [ref=e122]: CRM
            - generic [ref=e125]: Keep companies, contacts, deals, and customer context attached to the work.
      - generic [ref=e127]:
        - generic [ref=e129]:
          - paragraph [ref=e130]: Collaboration
          - heading "Keep conversations, knowledge, and files close to the work" [level=2] [ref=e131]
          - paragraph [ref=e132]: WorkGrind gives teams the communication and document systems they need to plan, align, and move work forward together.
        - generic [ref=e134]:
          - link "Communication Chat Use team channels and direct conversations to keep context close to the work." [ref=e136] [cursor=pointer]:
            - /url: /chat
            - generic [ref=e137]: Communication
            - generic [ref=e142]: Chat
            - generic [ref=e145]: Use team channels and direct conversations to keep context close to the work.
          - link "Meetings Meetings Schedule meetings, review notes, and capture action items tied to follow-up work." [ref=e147] [cursor=pointer]:
            - /url: /meetings
            - generic [ref=e148]: Meetings
            - generic [ref=e156]: Meetings
            - generic [ref=e159]: Schedule meetings, review notes, and capture action items tied to follow-up work.
          - link "Planning Whiteboard Visualize ideas, planning, and team thinking in a collaborative board space." [ref=e161] [cursor=pointer]:
            - /url: /whiteboard
            - generic [ref=e162]: Planning
            - generic [ref=e167]: Whiteboard
            - generic [ref=e170]: Visualize ideas, planning, and team thinking in a collaborative board space.
          - link "Knowledge Docs Create and organize shared documents that keep team knowledge in one place." [ref=e172] [cursor=pointer]:
            - /url: /docs
            - generic [ref=e173]: Knowledge
            - generic [ref=e178]: Docs
            - generic [ref=e181]: Create and organize shared documents that keep team knowledge in one place.
          - link "Content Files Organize workspace files with folders, previews, and search for the documents teams use every day." [ref=e183] [cursor=pointer]:
            - /url: /files
            - generic [ref=e184]: Content
            - generic [ref=e189]: Files
            - generic [ref=e192]: Organize workspace files with folders, previews, and search for the documents teams use every day.
          - link "Signals Notifications Review updates, stay on top of assigned work, and move from alert to action quickly." [ref=e194] [cursor=pointer]:
            - /url: /notifications
            - generic [ref=e195]: Signals
            - generic [ref=e201]: Notifications
            - generic [ref=e204]: Review updates, stay on top of assigned work, and move from alert to action quickly.
      - generic [ref=e206]:
        - generic [ref=e208]:
          - paragraph [ref=e209]: Operations
          - heading "Automation, analytics, and intelligent support" [level=2] [ref=e210]
          - paragraph [ref=e211]: "The workspace does more than track work: it helps teams understand activity, automate routine steps, and use supported AI tools with the right permissions."
        - generic [ref=e213]:
          - link "Insights Analytics Review task, project, CRM, and workspace activity to understand what is moving and what needs attention." [ref=e215] [cursor=pointer]:
            - /url: /analytics
            - generic [ref=e216]: Insights
            - generic [ref=e221]: Analytics
            - generic [ref=e224]: Review task, project, CRM, and workspace activity to understand what is moving and what needs attention.
          - link "Automation Automation Use supported triggers and configured actions for task creation, alerts, and channel updates." [ref=e226] [cursor=pointer]:
            - /url: /workflows
            - generic [ref=e227]: Automation
            - generic [ref=e234]: Automation
            - generic [ref=e237]: Use supported triggers and configured actions for task creation, alerts, and channel updates.
          - link "AI Tavro AI Get assistance with supported work and learning information in your workspace. Available data and actions depend on workspace, role, and plan." [ref=e239] [cursor=pointer]:
            - /url: /ai
            - generic [ref=e240]: AI
            - generic [ref=e246]: Tavro AI
            - generic [ref=e249]: Get assistance with supported work and learning information in your workspace. Available data and actions depend on workspace, role, and plan.
          - link "External access Client Portal Give clients a separate, permission-scoped place for shared project updates, messages, and approvals." [ref=e251] [cursor=pointer]:
            - /url: /client-portal
            - generic [ref=e252]: External access
            - generic [ref=e258]: Client Portal
            - generic [ref=e261]: Give clients a separate, permission-scoped place for shared project updates, messages, and approvals.
          - link "Access Team Manage people, roles, and the shared operational context behind the workspace." [ref=e263] [cursor=pointer]:
            - /url: /team
            - generic [ref=e264]: Access
            - generic [ref=e272]: Team
            - generic [ref=e275]: Manage people, roles, and the shared operational context behind the workspace.
          - link "Admin Settings Adjust personal and workspace preferences so the system matches how your team works." [ref=e277] [cursor=pointer]:
            - /url: /settings
            - generic [ref=e278]: Admin
            - generic [ref=e284]: Settings
            - generic [ref=e287]: Adjust personal and workspace preferences so the system matches how your team works.
      - generic [ref=e289]:
        - generic [ref=e291]:
          - paragraph [ref=e292]: Company capabilities
          - heading "Business tools for company workspaces" [level=2] [ref=e293]
          - paragraph [ref=e294]: CRM, Client Portal, and business integrations are company-oriented capabilities. Their availability depends on the workspace role and plan.
        - generic [ref=e296]:
          - link "Global voice Global Calling Use a WorkGrind Calling ID to reach any eligible user worldwide with secure audio and permission-aware call discovery." [ref=e298] [cursor=pointer]:
            - /url: /calling
            - generic [ref=e299]: Global voice
            - generic [ref=e304]: Global Calling
            - generic [ref=e307]: Use a WorkGrind Calling ID to reach any eligible user worldwide with secure audio and permission-aware call discovery.
          - link "Versioned API Connect API Connect a company website or application to scoped Contacts, CRM Companies, Deals, Projects, Tasks, and read-only Team endpoints." [ref=e309] [cursor=pointer]:
            - /url: /developer/docs
            - generic [ref=e310]: Versioned API
            - generic [ref=e317]: Connect API
            - generic [ref=e320]: Connect a company website or application to scoped Contacts, CRM Companies, Deals, Projects, Tasks, and read-only Team endpoints.
          - link "Developer access API Keys Owners and admins can create scoped read/write keys, see each secret once, then rotate or revoke access." [ref=e322] [cursor=pointer]:
            - /url: /developer
            - generic [ref=e323]: Developer access
            - generic [ref=e329]: API Keys
            - generic [ref=e332]: Owners and admins can create scoped read/write keys, see each secret once, then rotate or revoke access.
          - link "Delivery coming soon Webhooks Save HTTPS endpoints and event labels for a workspace. External event delivery is Coming Soon." [ref=e334] [cursor=pointer]:
            - /url: /developer
            - generic [ref=e335]: Delivery coming soon
            - generic [ref=e342]: Webhooks
            - generic [ref=e345]: Save HTTPS endpoints and event labels for a workspace. External event delivery is Coming Soon.
          - link "Scoped connectivity External websites & apps Use the Connect API from a trusted server to read or update the WorkGrind resources allowed by its key scopes." [ref=e347] [cursor=pointer]:
            - /url: /how-it-works#connect-api
            - generic [ref=e348]: Scoped connectivity
            - generic [ref=e356]: External websites & apps
            - generic [ref=e359]: Use the Connect API from a trusted server to read or update the WorkGrind resources allowed by its key scopes.
      - generic [ref=e361]:
        - generic [ref=e363]:
          - paragraph [ref=e364]: Choose a workspace
          - heading "Different needs, distinct experiences" [level=2] [ref=e365]
          - paragraph [ref=e366]: Choose an account type during signup. Available features depend on the persisted workspace type, your role, and plan.
        - generic [ref=e367]:
          - link "Solo Personal productivity, daily planning, tasks, projects, documents, and Tavro AI assistance where available." [ref=e368] [cursor=pointer]:
            - /url: /signup?workspace=solo
            - generic [ref=e369]: Solo
            - generic [ref=e372]: Personal productivity, daily planning, tasks, projects, documents, and Tavro AI assistance where available.
          - link "Company Office and business teams can use chat, meetings, tasks, projects, CRM, client portal, documents, files, workflows, and analytics where available." [ref=e373] [cursor=pointer]:
            - /url: /signup?workspace=business
            - generic [ref=e374]: Company
            - generic [ref=e377]: Office and business teams can use chat, meetings, tasks, projects, CRM, client portal, documents, files, workflows, and analytics where available.
          - link "School / Academy Support administrators, teachers, and students with classes, courses, timetables, attendance, assignments, online class meetings where enabled, exams, results, fee records, and communication." [ref=e378] [cursor=pointer]:
            - /url: /signup?workspace=school
            - generic [ref=e379]: School / Academy
            - generic [ref=e382]: Support administrators, teachers, and students with classes, courses, timetables, attendance, assignments, online class meetings where enabled, exams, results, fee records, and communication.
          - link "College Coordinate students, faculty, departments, courses, schedules, attendance, assignments, online meetings where enabled, assessments, results, fee records, and communication." [ref=e383] [cursor=pointer]:
            - /url: /signup?workspace=college
            - generic [ref=e384]: College
            - generic [ref=e387]: Coordinate students, faculty, departments, courses, schedules, attendance, assignments, online meetings where enabled, assessments, results, fee records, and communication.
          - link "University Support students, faculty, administrators, departments, courses, timetables, attendance, online meetings where enabled, assessments, results, fee records, and communication." [ref=e388] [cursor=pointer]:
            - /url: /signup?workspace=university
            - generic [ref=e389]: University
            - generic [ref=e392]: Support students, faculty, administrators, departments, courses, timetables, attendance, online meetings where enabled, assessments, results, fee records, and communication.
      - generic [ref=e394]:
        - generic [ref=e396]:
          - paragraph [ref=e397]: Administration
          - heading "Keep the workspace healthy and govern access" [level=2] [ref=e398]
          - paragraph [ref=e399]: The admin side helps teams manage roles, billing, preferences, and the operational infrastructure behind the workspace.
        - generic [ref=e401]:
          - link "Plan Billing Review plan details and subscription information from the workspace admin side." [ref=e403] [cursor=pointer]:
            - /url: /billing
            - generic [ref=e404]: Plan
            - generic [ref=e410]: Billing
            - generic [ref=e413]: Review plan details and subscription information from the workspace admin side.
          - link "Knowledge Files + Docs Keep shared, client-facing, and internal documents in the same operating system." [ref=e415] [cursor=pointer]:
            - /url: /files
            - generic [ref=e416]: Knowledge
            - generic [ref=e422]: Files + Docs
            - generic [ref=e425]: Keep shared, client-facing, and internal documents in the same operating system.
      - generic [ref=e428]:
        - paragraph [ref=e429]: WorkGrind workspaces
        - heading "Start with the workspace that fits your work." [level=2] [ref=e430]
        - paragraph [ref=e431]: Choose Solo, Company, School / Academy, College, or University during signup.
        - generic [ref=e432]:
          - link "Get Started" [ref=e433] [cursor=pointer]:
            - /url: /signup
          - link "Learn the workflow" [ref=e436] [cursor=pointer]:
            - /url: /how-it-works
    - contentinfo [ref=e439]:
      - generic [ref=e440]:
        - generic [ref=e441]:
          - generic [ref=e442]:
            - img "WorkGrind" [ref=e443]:
              - generic [aria-hidden] [ref=e447]:
                - generic [ref=e448]: Work
                - generic [ref=e449]: Grind
            - paragraph [ref=e450]: A connected workspace for personal work, business, and education.
            - link "Follow WorkGrind on Instagram" [ref=e452] [cursor=pointer]:
              - /url: https://www.instagram.com/workgrind2026?utm_source=qr&stkn=NTJ5MHNuNWJ3bjJp
          - generic [ref=e457]:
            - heading "Company" [level=3] [ref=e458]
            - list [ref=e459]:
              - listitem [ref=e460]:
                - link "About" [ref=e461] [cursor=pointer]:
                  - /url: /about
              - listitem [ref=e462]:
                - link "Features" [ref=e463] [cursor=pointer]:
                  - /url: /features
              - listitem [ref=e464]:
                - link "Demo" [ref=e465] [cursor=pointer]:
                  - /url: /demo
              - listitem [ref=e466]:
                - link "Contact" [ref=e467] [cursor=pointer]:
                  - /url: /contact
          - generic [ref=e468]:
            - heading "Legal" [level=3] [ref=e469]
            - list [ref=e470]:
              - listitem [ref=e471]:
                - link "Privacy Policy" [ref=e472] [cursor=pointer]:
                  - /url: /privacy
              - listitem [ref=e473]:
                - link "Terms of Service" [ref=e474] [cursor=pointer]:
                  - /url: /terms
              - listitem [ref=e475]:
                - link "Cookie Preferences" [ref=e476] [cursor=pointer]:
                  - /url: /cookies
              - listitem [ref=e477]:
                - link "Refund Policy" [ref=e478] [cursor=pointer]:
                  - /url: /refunds
              - listitem [ref=e479]:
                - link "Cancellation Policy" [ref=e480] [cursor=pointer]:
                  - /url: /cancellation
              - listitem [ref=e481]:
                - link "Disclaimer" [ref=e482] [cursor=pointer]:
                  - /url: /disclaimer
          - generic [ref=e483]:
            - heading "Trust & Security" [level=3] [ref=e484]
            - list [ref=e485]:
              - listitem [ref=e486]:
                - link "Security" [ref=e487] [cursor=pointer]:
                  - /url: /security
              - listitem [ref=e488]:
                - link "Responsible Disclosure" [ref=e489] [cursor=pointer]:
                  - /url: /responsible-disclosure
              - listitem [ref=e490]:
                - link "Accessibility" [ref=e491] [cursor=pointer]:
                  - /url: /accessibility
              - listitem [ref=e492]:
                - link "Data Processing Agreement" [ref=e493] [cursor=pointer]:
                  - /url: /dpa
              - listitem [ref=e494]:
                - link "Acceptable Use" [ref=e495] [cursor=pointer]:
                  - /url: /acceptable-use
              - listitem [ref=e496]:
                - link "Community Guidelines" [ref=e497] [cursor=pointer]:
                  - /url: /community-guidelines
          - generic [ref=e498]:
            - heading "Support" [level=3] [ref=e499]
            - list [ref=e500]:
              - listitem [ref=e501]:
                - link "Help Center" [ref=e502] [cursor=pointer]:
                  - /url: /help
              - listitem [ref=e503]:
                - link "Support" [ref=e504] [cursor=pointer]:
                  - /url: /support
        - generic [ref=e505]:
          - paragraph [ref=e506]: © 2026 WorkGrind. All rights reserved.
          - button "English , select language" [ref=e508] [cursor=pointer]:
            - generic [ref=e512]: English
            - generic [ref=e513]: ", select language"
  - alert [ref=e516]
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