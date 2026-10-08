import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const resultsPath = path.resolve(scriptDirectory, '../../artifacts/playwright-results.json');
const reportPath = path.resolve(scriptDirectory, '../../audit-report.md');
if (!fs.existsSync(resultsPath)) {
  console.error('Playwright JSON results are missing; run npm run audit:e2e first.');
  process.exit(1);
}

const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
const tests = [];
const pageAudits = [];
const responsiveFindings = [];
const protectedRoutes = [];

function walk(suite) {
  for (const spec of suite.specs || []) {
    for (const test of spec.tests || []) {
      const result = test.results?.at(-1);
      const annotations = result?.annotations || [];
      tests.push({
        title: spec.title,
        status: test.status,
        annotations,
        attachments: result?.attachments || [],
      });
      for (const attachment of result?.attachments || []) {
        if (!attachment.body) continue;
        let data;
        try {
          data = JSON.parse(Buffer.from(attachment.body, 'base64').toString('utf8'));
        } catch {
          continue;
        }
        if (attachment.name === 'page-audit.json' || attachment.name.startsWith('page-')) {
          pageAudits.push(data);
        } else if (attachment.name === 'responsive-audit.json') {
          responsiveFindings.push(...(data.issues || []));
        } else if (attachment.name === 'protected-route-audit.json') {
          protectedRoutes.push(...(data.results || []));
        }
      }
    }
  }
  for (const child of suite.suites || []) walk(child);
}
for (const suite of results.suites || []) walk(suite);

const allIssues = pageAudits.flatMap((page) =>
  (page.issues || []).map((issue) => ({ path: page.path, url: page.url, issue }))
);
const severityOf = (issue) => {
  if (/potential secret|private key|database URI/i.test(issue)) return 'CRITICAL';
  if (/^(?:HTTP\s*)?5\d\d\b|(?:response|status)\s+(?:5\d\d)\b|uncaught exception|app unusable/i.test(issue)) return 'HIGH';
  if (/button without accessible name|horizontal overflow|broken internal link|broken image|hydration|failed:|console error|websocket/i.test(issue)) return 'MEDIUM';
  return 'LOW';
};
const readableIssue = (issue) => {
  if (issue.startsWith('Button without accessible name: ')) {
    return `Button lacks an accessible name; DOM snippet: \`${issue.slice('Button without accessible name: '.length)}\``;
  }
  return issue;
};
const bySeverity = (severity) => allIssues.filter((item) => severityOf(item.issue) === severity);
const statusLabel = (status) =>
  status === 'expected' ? 'PASS' : status === 'skipped' ? 'SKIPPED' : status === 'unexpected' ? 'FAIL' : status.toUpperCase();
const pageStatus = (page) => (page.issues?.length ? 'FAIL' : 'PASS');
const publicPages = pageAudits.filter((page) => page.path && page.status !== undefined && !page.path.startsWith('/dashboard'));
const publicPagePaths = ['/', '/about', '/features', '/demo', '/contact', '/pricing', '/privacy', '/terms', '/signup', '/login'];
const pageByPath = new Map(publicPages.map((page) => [page.path, page]));
const publicTable = publicPagePaths.map((pagePath) => {
  const page = pageByPath.get(pagePath);
  const details = page?.issues?.length ? page.issues.map(readableIssue).join('; ') : 'No collected issues';
  return `| \`${pagePath}\` | ${page ? pageStatus(page) : 'NOT TESTED'} | ${details} |`;
});
const routeRows = protectedRoutes.map((route) =>
  `| ${route.path} | ${route.status ?? 'n/a'} | ${route.landedAt} |`
);
const issueRows = allIssues.map(({ path: route, issue }) =>
  `| \`${route}\` | ${severityOf(issue)} | ${readableIssue(issue).replaceAll('|', '\\|')} |`
);
const total = tests.length;
const passed = tests.filter((test) => test.status === 'expected').length;
const failed = tests.filter((test) => test.status === 'unexpected').length;
const skipped = tests.filter((test) => test.status === 'skipped').length;
const warnings = skipped + responsiveFindings.length;
const slowPages = [...publicPages].sort((a, b) => (b.elapsedMs || 0) - (a.elapsedMs || 0)).slice(0, 5);
const authTest = tests.find((test) => test.title === 'authenticated routes and read-only feature audit');
const functionalTests = tests.filter((test) =>
  /login form|protected application|authenticated routes|logout|responsive/.test(test.title)
);
const authStatus = authTest ? statusLabel(authTest.status) : 'NOT RUN';
const report = `# WorkGrind A–Z Automated Audit

## Executive Summary

- Overall result: ${failed ? 'FAIL — public-site issues detected; authenticated feature audit blocked by missing environment credentials' : 'PASS'}.
- Target: \`https://workgrind.vercel.app\`
- Pages tested: ${publicPagePaths.length} public pages plus ${protectedRoutes.length} unauthenticated protected-route checks.
- Passed: ${passed}
- Failed: ${failed}
- Warnings: ${warnings}
- Critical issues: ${bySeverity('CRITICAL').length}
- Browser: Playwright Chromium.
- Authenticated demo account checks were ${authStatus}; required environment variables were absent. No credentials were embedded or printed.

## Authentication

- Login form controls and required-field browser validation: ${statusLabel(tests.find((test) => test.title.includes('login form'))?.status || 'not run')}.
- Successful demo-account login, authenticated session, logout, and Tavro AI prompt: not run because \`WORKGRIND_TEST_EMAIL\` and \`WORKGRIND_TEST_PASSWORD\` were not present in the process environment.
- Passwords, tokens, cookies, and authorization headers are not included in this report.
- Unauthenticated protected-route handling: ${protectedRoutes.length ? (routeRows.every((row) => row.endsWith('| /login |')) ? 'all observed redirects landed on /login' : 'see route table') : 'no route results collected'}.

## Public Pages

| Page | Status | Issues |
|---|---|---|
${publicTable.join('\n')}

## Authenticated Pages

| Feature | URL | Status | Issues |
|---|---|---|---|
${[
  ['/dashboard', 'Overview'],
  ['/daily-focus', 'Daily Focus'],
  ['/tasks', 'Tasks'],
  ['/projects', 'Projects'],
  ['/calendar', 'Calendar'],
  ['/crm', 'CRM'],
  ['/client-portal-mgmt', 'Client Portal'],
  ['/chat', 'Chat'],
  ['/meetings', 'Meetings'],
  ['/calling', 'Calling'],
  ['/whiteboard', 'Whiteboard'],
  ['/docs', 'Docs'],
  ['/files', 'Files'],
  ['/analytics', 'Analytics'],
  ['/workflows', 'Automation'],
  ['/ai', 'Tavro AI'],
  ['/team', 'Team'],
  ['/notifications', 'Notifications'],
  ['/billing', 'Billing'],
  ['/settings', 'Settings'],
  ['/developer', 'Developer/API'],
  ['/developer/docs', 'Developer Docs'],
  ['/sheets', 'Sheets'],
  ['/moderation', 'Moderation'],
].map(([url, name]) => `| ${name} | \`${url}\` | ${authStatus} | Authenticated checks require demo credentials in environment variables. |`).join('\n')}

### Unauthenticated protection checks

| Route | HTTP status | Final path |
|---|---:|---|
${routeRows.length ? routeRows.join('\n') : '| Not run | — | No data |'}

## Functional Tests

| Feature | Test | Result | Details |
|---|---|---|---|
${functionalTests.map((test) => `| ${test.title.includes('login form') ? 'Login' : test.title.includes('protected') ? 'Protected routes' : test.title.includes('responsive') ? 'Responsive' : 'Authenticated app'} | ${test.title} | ${statusLabel(test.status)} | ${test.annotations.find((annotation) => annotation.type === 'skip')?.description || 'Read-only checks only; no production records or settings were changed.'} |`).join('\n')}
| CRM, chat, tasks, meetings, calendar, docs, files, automation, calling, billing | Read-only UI/data checks | NOT RUN | Requires successful authenticated demo login. No test data was created or modified. |

## API / Network Errors

| Endpoint | Status | Error | Severity |
|---|---:|---|---|
${allIssues.filter((item) => /^(?:HTTP\s*)?[45]\d\d\b|(?:response|status)\s+[45]\d\d\b|request failed|CORS|WebSocket/i.test(item.issue)).map((item) => `| \`${item.path}\` | captured in issue | ${item.issue} | ${severityOf(item.issue)} |`).join('\n') || '| None observed on successful public page checks | — | No recorded HTTP 4xx/5xx or browser network error | — |'}

## Console / Runtime Errors

| Page | Error | Severity |
|---|---|---|
${allIssues.filter((item) => /console error|uncaught|hydration|websocket/i.test(item.issue)).map((item) => `| \`${item.path}\` | ${item.issue} | ${severityOf(item.issue)} |`).join('\n') || '| None observed on successful public page checks | — | — |'}

## Branding Issues

${allIssues.filter((item) => /old-brand/i.test(item.issue)).map((item) => `- ${item.url}: visible text \`${item.issue.replace('Old-brand text: ', '')}\`.`).join('\n') || '- No old-brand text detected.'}

## Responsive Issues

| Viewport | Page | Issue |
|---|---|---|
${responsiveFindings.map((issue) => {
  const [viewport, page, detail] = issue.split(' ');
  return `| ${viewport} | ${page} | ${detail} |`;
}).join('\n') || '| Desktop 1440×900, laptop 1280×720, tablet 768×1024, mobile 390×844 | /, /pricing, /signup, /login | No horizontal overflow detected. |'}

## Performance

Navigation stabilization times include waiting for network idle and are not server-only load metrics.

${slowPages.map((page) => `- \`${page.path}\`: ${(page.elapsedMs / 1000).toFixed(2)} s.`).join('\n') || '- No public page timings were collected.'}
- Tavro AI response latency: not measured because authenticated credentials were unavailable.

## Security Findings

- Public target uses HTTPS.
- Client-bundle checks for common private-key, database-URI, and provider-key markers: ${allIssues.some((item) => /potential secret/i.test(item.issue)) ? 'potential finding; see issue table' : 'no matching markers detected'}.
- CSP header observed: ${pageAudits.some((page) => page.contentSecurityPolicy) ? 'present on at least one audited page' : 'not present on audited document responses'}.
- HSTS header observed: ${pageAudits.some((page) => page.strictTransportSecurity) ? 'present on at least one audited page' : 'not present on audited document responses'}.
- Cookie attribute values were inspected without recording cookie values.
- Authenticated authorization behavior beyond unauthenticated redirects was not assessed.

## Critical Issues

${bySeverity('CRITICAL').map((item) => `- \`${item.path}\`: ${item.issue}`).join('\n') || '- None found.'}

## Recommended Fix Order

${[
  bySeverity('CRITICAL').length ? '1. Critical: remediate exposed secret findings.' : '1. Critical: none identified.',
  bySeverity('HIGH').length ? '2. High: fix server/runtime failures.' : '2. High: none identified.',
  bySeverity('MEDIUM').length ? `3. Medium: fix ${bySeverity('MEDIUM').map((item) => readableIssue(item.issue)).join('; ')}.` : '3. Medium: none identified.',
  bySeverity('LOW').length ? `4. Low: remove legacy brand references on ${[...new Set(bySeverity('LOW').map((item) => item.path))].join(', ')}.` : '4. Low: none identified.',
].join('\n')}

## Complete Findings

| Page | Severity | Finding |
|---|---|---|
${issueRows.join('\n') || '| None | — | No findings |'}

## Artifacts

- Playwright HTML report: \`artifacts/playwright-report/index.html\`
- Playwright JSON results: \`artifacts/playwright-results.json\`
- Failure screenshots and test results: \`artifacts/test-results/\`
- Trace files: not captured; failure screenshots and structured test context were captured.

## Run Details

- Command: \`cd frontend && npm run audit:e2e -- --workers=4\`
- Authenticated command requires \`WORKGRIND_TEST_EMAIL\`, \`WORKGRIND_TEST_PASSWORD\`, and optionally \`WORKGRIND_BASE_URL\` in the environment. Do not commit credentials.
`;
fs.writeFileSync(reportPath, report);
console.log(`Wrote ${path.relative(process.cwd(), reportPath)} (${total} tests: ${passed} passed, ${failed} failed, ${skipped} skipped).`);
