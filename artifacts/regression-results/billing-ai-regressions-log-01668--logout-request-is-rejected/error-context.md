# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: billing-ai-regressions.spec.ts >> logout does not refresh a session after its logout request is rejected
- Location: tests\billing-ai-regressions.spec.ts:700:5

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: locator.click: Test timeout of 60000ms exceeded.
Call log:
  - waiting for locator('aside button[aria-haspopup="menu"]')
    - locator resolved to <button aria-haspopup="menu" aria-expanded="false" class="↵              flex w-full items-center gap-3 rounded-xl p-2↵              transition-all duration-150 hover:theme-bg-hover↵              ↵            ">…</button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <nextjs-portal></nextjs-portal> from <script data-nextjs-dev-overlay="true">…</script> subtree intercepts pointer events
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <nextjs-portal></nextjs-portal> from <script data-nextjs-dev-overlay="true">…</script> subtree intercepts pointer events
    - retrying click action
      - waiting 100ms
    99 × waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - <nextjs-portal></nextjs-portal> from <script data-nextjs-dev-overlay="true">…</script> subtree intercepts pointer events
     - retrying click action
       - waiting 500ms
    - waiting for element to be visible, enabled and stable
    - element is visible, enabled and stable
    - scrolling into view if needed
    - done scrolling

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e6] [cursor=pointer]:
    - button "Open Next.js Dev Tools" [ref=e7]
    - generic [ref=e11]:
      - button "Open issues overlay" [ref=e12]:
        - generic [ref=e13]:
          - generic [aria-hidden] [ref=e14]: "0"
          - generic [ref=e15]: "1"
        - generic [ref=e16]: Insight
      - button "Collapse issues badge" [ref=e17]
  - alert [ref=e20]
  - generic [ref=e21]:
    - complementary [ref=e22]:
      - generic [ref=e23]:
        - img "WorkGrind" [ref=e25]
        - generic [ref=e29]:
          - generic [ref=e30]: Regression Workspace
          - generic [ref=e31]: Owner
      - navigation [ref=e34]:
        - generic [ref=e35]:
          - generic [ref=e36]:
            - generic [ref=e37]: Workspace
            - generic [ref=e38]:
              - link "Overview" [ref=e39] [cursor=pointer]:
                - /url: /dashboard
              - link "Daily Focus" [ref=e46] [cursor=pointer]:
                - /url: /daily-focus
              - link "Tasks" [ref=e52] [cursor=pointer]:
                - /url: /tasks
              - link "Projects" [ref=e57] [cursor=pointer]:
                - /url: /projects
              - link "Calendar" [ref=e61] [cursor=pointer]:
                - /url: /calendar
          - generic [ref=e65]:
            - generic [ref=e66]: Customers
            - generic [ref=e67]:
              - link "CRM" [ref=e68] [cursor=pointer]:
                - /url: /crm
              - link "Client Portal" [ref=e75] [cursor=pointer]:
                - /url: /client-portal-mgmt
          - generic [ref=e80]:
            - generic [ref=e81]: Collaborate
            - generic [ref=e82]:
              - link "Chat" [ref=e83] [cursor=pointer]:
                - /url: /chat
              - link "Meetings" [ref=e87] [cursor=pointer]:
                - /url: /meetings
              - link "Global Calling" [ref=e91] [cursor=pointer]:
                - /url: /calling
              - link "Whiteboard" [ref=e97] [cursor=pointer]:
                - /url: /whiteboard
              - link "Docs" [ref=e102] [cursor=pointer]:
                - /url: /docs
          - generic [ref=e107]:
            - generic [ref=e108]: Resources
            - generic [ref=e109]:
              - link "Files" [ref=e110] [cursor=pointer]:
                - /url: /files
              - link "Sheets" [ref=e114] [cursor=pointer]:
                - /url: /sheets
              - link "Analytics" [ref=e118] [cursor=pointer]:
                - /url: /analytics
              - link "Automation" [ref=e122] [cursor=pointer]:
                - /url: /workflows
              - link "Social Publishing" [ref=e128] [cursor=pointer]:
                - /url: /social-publishing
          - generic [ref=e136]:
            - generic [ref=e137]: Intelligence
            - link "Tavro AI" [ref=e139] [cursor=pointer]:
              - /url: /ai
          - generic [ref=e144]:
            - generic [ref=e145]: Admin
            - generic [ref=e146]:
              - link "Team" [ref=e147] [cursor=pointer]:
                - /url: /team
              - link "Notifications" [ref=e153] [cursor=pointer]:
                - /url: /notifications
              - link "Billing" [ref=e158] [cursor=pointer]:
                - /url: /billing
              - link "Settings" [ref=e162] [cursor=pointer]:
                - /url: /settings
      - button "RU Regression User Owner" [ref=e169] [cursor=pointer]:
        - generic [ref=e170]: RU
        - generic [ref=e174]:
          - generic [ref=e175]: Regression User
          - generic [ref=e176]: Owner
    - generic [ref=e179]:
      - banner [ref=e180]:
        - generic [ref=e181]:
          - button "Toggle sidebar" [ref=e182] [cursor=pointer]
          - link "WorkGrind home" [ref=e184] [cursor=pointer]:
            - /url: /dashboard
            - img "WorkGrind" [ref=e186]:
              - generic [aria-hidden] [ref=e190]:
                - generic [ref=e191]: Work
                - generic [ref=e192]: Grind
          - button "Open search (Ctrl+K)" [ref=e193] [cursor=pointer]:
            - generic [ref=e197]: Search anything...
            - generic [ref=e198]: ⌘K
        - generic [ref=e199]:
          - generic [ref=e200]: Online
          - button "New" [ref=e205] [cursor=pointer]
          - button "Notifications" [ref=e211] [cursor=pointer]
          - link "Account settings" [ref=e215] [cursor=pointer]:
            - /url: /settings
            - generic [ref=e216]: RU
      - main [ref=e217]:
        - generic [ref=e219]:
          - generic [ref=e220]:
            - generic [ref=e226]:
              - heading "Tavro AI" [level=2] [ref=e227]
              - paragraph [ref=e228]: Workspace-aware · Action-capable
            - generic [ref=e229]:
              - generic [ref=e230]: Active
              - button "Voice" [ref=e231] [cursor=pointer]
              - button "History" [ref=e236] [cursor=pointer]
          - generic [ref=e247]:
            - generic [ref=e249]:
              - paragraph [ref=e250]: Hello Regression! 👋 I'm Tavro AI, WorkGrind's assistant for business and education workspaces.
              - paragraph [ref=e251]: Ask me about WorkGrind, or request help with information and actions available to your role and plan.
            - paragraph [ref=e253]: 05:00 AM
          - generic [ref=e254]:
            - paragraph [ref=e255]: Quick actions
            - generic [ref=e256]:
              - button "Overdue tasks" [ref=e257] [cursor=pointer]
              - button "Week summary" [ref=e261] [cursor=pointer]
              - button "Analyze CRM" [ref=e263] [cursor=pointer]
              - button "Today's priorities" [ref=e268] [cursor=pointer]
              - button "Team overview" [ref=e272] [cursor=pointer]
              - button "Find a client" [ref=e278] [cursor=pointer]
          - generic [ref=e282]:
            - generic [ref=e283]:
              - textbox "Ask me to find tasks, create meetings, analyze deals…" [ref=e284]
              - button "Send" [disabled] [ref=e285]
            - paragraph [ref=e289]: Press Enter to send · Shift+Enter for new line
```

# Test source

```ts
  624 |   expect(mainFrameNavigations).toHaveLength(settledNavigations);
  625 | });
  626 | 
  627 | test('concurrent expired API requests share one refresh and preserve the current route', async ({ page }) => {
  628 |   test.setTimeout(120_000);
  629 |   const state = makeApiState();
  630 |   state.messages.push({
  631 |     role: 'assistant',
  632 |     content: 'Restored conversation',
  633 |     createdAt: new Date().toISOString(),
  634 |   });
  635 |   const refreshRequests: number[] = [];
  636 |   const unauthorizedPaths = new Map([
  637 |     ['/subscription/status', 1],
  638 |     [`/ai/agent/conversations/${conversationId}`, 1],
  639 |   ]);
  640 |   await page.addInitScript((id) => {
  641 |     sessionStorage.setItem('workgrind_access_token', 'playwright-expired-access');
  642 |     sessionStorage.setItem('workgrind:ai:active-conversation:playwright-user', id);
  643 |   }, conversationId);
  644 |   await page.routeWebSocket('**/socket.io/**', (socket) => {
  645 |     socket.close({ code: 1000, reason: 'Socket.IO is not under test.' });
  646 |   });
  647 |   await page.route('**/api/**', (route) => mockApi(route, {
  648 |     ...state,
  649 |     failSubscriptionRequestAt: undefined,
  650 |     failFirstAgentRequest: false,
  651 |     refreshDelayMs: 150,
  652 |     refreshRequests,
  653 |     unauthorizedPaths,
  654 |   }));
  655 |   await page.goto('/ai');
  656 | 
  657 |   await expect(page.getByPlaceholder(/Ask me to find tasks/)).toBeVisible();
  658 |   await expect(page.getByText('Restored conversation')).toBeVisible();
  659 |   expect(refreshRequests).toHaveLength(1);
  660 |   await expect(page).toHaveURL(/\/ai$/);
  661 | });
  662 | 
  663 | test('login 401 is not retried with a stale access token', async ({ page }) => {
  664 |   const refreshRequests: number[] = [];
  665 |   let loginRequests = 0;
  666 |   await page.route('**/api/**', async (route) => {
  667 |     const pathname = new URL(route.request().url()).pathname;
  668 |     if (pathname.endsWith('/auth/login')) {
  669 |       loginRequests += 1;
  670 |       await route.fulfill({
  671 |         status: 401,
  672 |         contentType: 'application/json',
  673 |         body: JSON.stringify({ success: false, message: 'Invalid credentials.' }),
  674 |       });
  675 |       return;
  676 |     }
  677 |     await mockApi(route, {
  678 |       ...makeApiState(),
  679 |       failSubscriptionRequestAt: undefined,
  680 |       failFirstAgentRequest: false,
  681 |       refreshStatus: 401,
  682 |       refreshRequests,
  683 |     });
  684 |   });
  685 |   await page.goto('/login');
  686 |   await page.getByLabel('Email address').fill('invalid@example.invalid');
  687 |   await expect.poll(() => refreshRequests.length).toBe(1);
  688 |   await page.evaluate(() => {
  689 |     sessionStorage.setItem('workgrind_access_token', 'playwright-stale-access');
  690 |   });
  691 |   await page.locator('#login-password').fill('not-a-real-secret');
  692 |   await page.getByRole('button', { name: /Sign in to WorkGrind/ }).click();
  693 | 
  694 |   await expect(page.locator('.auth-error[role="alert"]')).toContainText('Invalid credentials.');
  695 |   expect(loginRequests).toBe(1);
  696 |   expect(refreshRequests).toHaveLength(1);
  697 |   await expect(page).toHaveURL(/\/login$/);
  698 | });
  699 | 
  700 | test('logout does not refresh a session after its logout request is rejected', async ({ page }) => {
  701 |   await setSessionAuth(page);
  702 |   const refreshRequests: number[] = [];
  703 |   let logoutRequests = 0;
  704 |   await page.route('**/api/**', async (route) => {
  705 |     const pathname = new URL(route.request().url()).pathname;
  706 |     if (pathname.endsWith('/auth/logout')) {
  707 |       logoutRequests += 1;
  708 |       await route.fulfill({
  709 |         status: 401,
  710 |         contentType: 'application/json',
  711 |         body: JSON.stringify({ success: false, message: 'Session already expired.' }),
  712 |       });
  713 |       return;
  714 |     }
  715 |     await mockApi(route, {
  716 |       ...makeApiState(),
  717 |       failSubscriptionRequestAt: undefined,
  718 |       failFirstAgentRequest: false,
  719 |       refreshRequests,
  720 |     });
  721 |   });
  722 |   await page.goto('/ai');
  723 |   await expect(page.getByPlaceholder(/Ask me to find tasks/)).toBeVisible();
> 724 |   await page.locator('aside button[aria-haspopup="menu"]').click();
      |                                                            ^ Error: locator.click: Test timeout of 60000ms exceeded.
  725 |   await page.getByRole('menuitem', { name: 'Sign out' }).click();
  726 | 
  727 |   await expect(page).toHaveURL(/\/login\?redirect=/);
  728 |   expect(logoutRequests).toBe(1);
  729 |   expect(refreshRequests).toHaveLength(0);
  730 | });
  731 | 
  732 | test('the initial service-worker takeover does not trigger a full-page reload', () => {
  733 |   expect(shouldReloadForServiceWorkerControllerChange(false, false)).toBe(false);
  734 |   expect(shouldReloadForServiceWorkerControllerChange(true, true)).toBe(false);
  735 |   expect(shouldReloadForServiceWorkerControllerChange(true, false)).toBe(true);
  736 | });
  737 | 
  738 | test('refresh requests from two tabs are serialized while refresh-token cookies rotate', async ({ browser }) => {
  739 |   const context = await browser.newContext();
  740 |   const firstPage = await context.newPage();
  741 |   const secondPage = await context.newPage();
  742 |   const activeRefreshRequests = { count: 0, maximum: 0 };
  743 |   const refreshCount = { count: 0 };
  744 |   const createPageHandler = (page401: { value: boolean }) => async (route: Route) => {
  745 |     const pathname = new URL(route.request().url()).pathname;
  746 |     if (pathname.endsWith('/auth/refresh')) {
  747 |       refreshCount.count += 1;
  748 |       activeRefreshRequests.count += 1;
  749 |       activeRefreshRequests.maximum = Math.max(activeRefreshRequests.maximum, activeRefreshRequests.count);
  750 |       await new Promise((resolve) => setTimeout(resolve, 100));
  751 |       const responseNumber = refreshCount.count;
  752 |       await route.fulfill({
  753 |         status: 200,
  754 |         headers: {
  755 |           'set-cookie': `wg_refresh=rotated-${responseNumber}; Path=/api/auth; HttpOnly; Secure; SameSite=Lax`,
  756 |         },
  757 |         contentType: 'application/json',
  758 |         body: JSON.stringify({ success: true, accessToken: `playwright-rotated-access-${responseNumber}` }),
  759 |       });
  760 |       activeRefreshRequests.count -= 1;
  761 |       return;
  762 |     }
  763 |     await mockApi(route, {
  764 |       ...makeApiState(),
  765 |       failSubscriptionRequestAt: undefined,
  766 |       failFirstAgentRequest: false,
  767 |       expireCurrentUserOnce: page401,
  768 |     });
  769 |   };
  770 | 
  771 |   await Promise.all([firstPage, secondPage].map((page) => page.addInitScript(() => {
  772 |     sessionStorage.setItem('workgrind_access_token', 'playwright-regression-access');
  773 |   })));
  774 |   await firstPage.route('**/api/**', createPageHandler({ value: false }));
  775 |   await secondPage.route('**/api/**', createPageHandler({ value: false }));
  776 |   await Promise.all([firstPage.goto('/ai'), secondPage.goto('/ai')]);
  777 |   await Promise.all([
  778 |     expect(firstPage.getByPlaceholder(/Ask me to find tasks/)).toBeVisible(),
  779 |     expect(secondPage.getByPlaceholder(/Ask me to find tasks/)).toBeVisible(),
  780 |   ]);
  781 | 
  782 |   expect(refreshCount.count).toBe(2);
  783 |   expect(activeRefreshRequests.maximum).toBe(1);
  784 |   await context.close();
  785 | });
  786 | 
  787 | test('production CSP connection sources include only the configured API and LiveKit origins plus ICE schemes', () => {
  788 |   expect(getTrustedConnectionSources(
  789 |     'https://backend-workgrind.vercel.app/api',
  790 |     'wss://work-grind-bjshvbs1.livekit.cloud',
  791 |   )).toEqual([
  792 |     'https://backend-workgrind.vercel.app',
  793 |     'wss://backend-workgrind.vercel.app',
  794 |     'wss://work-grind-bjshvbs1.livekit.cloud',
  795 |     'https://work-grind-bjshvbs1.livekit.cloud',
  796 |     'stun:',
  797 |     'turn:',
  798 |     'turns:',
  799 |   ]);
  800 | });
  801 | 
  802 | test('Socket.IO targets the configured backend and uses the Vercel function socket path', () => {
  803 |   expect(resolveSocketUrl(
  804 |     undefined,
  805 |     'https://backend-workgrind.vercel.app/api',
  806 |     'https://workgrind.vercel.app',
  807 |     false,
  808 |   )).toBe('https://backend-workgrind.vercel.app');
  809 |   expect(SOCKET_IO_PATH).toBe('/api/socket-io/socket.io');
  810 | });
  811 | 
  812 | test('Tavro shows retry controls when the agent API returns a server error', async ({ page }) => {
  813 |   const state = makeApiState();
  814 |   await setSessionAuth(page);
  815 |   await page.route('**/api/**', (route) => mockApi(route, {
  816 |     ...state,
  817 |     failSubscriptionRequestAt: undefined,
  818 |     failFirstAgentRequest: true,
  819 |   }));
  820 |   await page.goto('/ai');
  821 |   const composer = page.getByPlaceholder(/Ask me to find tasks/);
  822 |   await expect(composer).toBeVisible();
  823 |   await composer.fill('A harmless retry test.');
  824 |   await page.getByRole('button', { name: 'Send' }).click();
```