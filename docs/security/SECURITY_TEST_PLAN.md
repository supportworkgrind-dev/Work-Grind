# WorkGrind Security Test Plan

This plan prioritizes repeatable authorization and boundary checks. Test only against local or explicitly isolated test environments with synthetic accounts/data. Do not use production customer data or real provider credentials in automated test output.

## Automated checks currently present

The full backend test command `npm run test:auth-refresh` ran after the compatible dependency updates and passed 110 tests. It builds TypeScript before running `tests/*.test.cjs`.

### Added for this audit

From `backend`:

```powershell
npm run build
node --test tests/security-boundaries.test.cjs
```

The regression file uses model mocks and covers:

- Non-members cannot retrieve private channel details.
- Channel and file lookups keep a synthetic foreign-workspace object ID scoped to the caller workspace.
- A message-history request cannot query messages before the channel has been authorized.
- Message history requires a valid channel ID.
- Academic file downloads require uploader/shared-view scope.
- Academic file deletion requires uploader/shared-edit scope, not view-only scope.

### Existing focused coverage

- `backend/tests/socket-authorization.test.cjs` — feature/role checks for socket events.
- `backend/tests/ai-agent.test.cjs` — tool scoping/availability, role rules, and agent execution behavior.
- `backend/tests/auth-refresh.test.cjs`, `backend/tests/auth-email.test.cjs`, `backend/tests/oauth-callback.test.cjs`, and `backend/tests/oauth-linkedin.test.cjs` — selected authentication, refresh, and OAuth behavior.
- Academic and organization access tests cover selected role/department and feature-gate behavior.

These are targeted suites, not a full penetration test or a substitute for integration testing against a disposable database.

## Release-blocking regression matrix

| Area | Required setup and negative cases | Expected result |
|---|---|---|
| Tenant/object access | Two synthetic workspaces; exchange IDs for files, tasks, projects, CRM, channels, and academic records | No cross-tenant read/write; use consistent not-found/forbidden semantics |
| Private collaboration | Two users in one workspace; private channel member and non-member; DM participant and non-participant | Non-members cannot fetch metadata/history, join socket rooms, or mutate content |
| Academic files | Uploader, view-only recipient, edit recipient, unrelated student, admin; exercise list/download/update/delete | View role can read only; edit role can update/delete only; unrelated user cannot fetch by ID |
| Authentication / roles | Active, inactive, unverified, deleted, MFA-pending and MFA-complete users; stale role/workspace claims | Requests fail closed; current persisted membership/role is used |
| OAuth | Mock providers; wrong state/nonce/audience/issuer/signature, replayed code, open redirect, account-link collision | Callback rejects invalid/replayed inputs and never silently links by email alone |
| Billing | Polar test/sandbox events: invalid signature, stale timestamp, replay, wrong product/workspace, duplicate event | No state change on invalid input; duplicate delivery is idempotent; real signed raw-body event succeeds |
| Integration webhook | Missing/malformed/valid HMAC, invalid URL token, inactive integration, oversized body | Reject unsigned/invalid messages once signature policy is enforced; do not leak token or secret |
| Uploads / R2 | Oversized files, mismatched extension/MIME/signature, traversal names, foreign workspace IDs, expired signed URLs | Enforce limits, prevent cross-tenant access, serve non-executable content safely |
| Socket.IO | Invalid/expired token, changed role/subscription, unauthorized channel/DM/meeting/call IDs, reconnect after revocation | Reject connection/event or disconnect after authorization is no longer valid |
| Tavro | Tool argument IDs from another tenant, role-restricted writes, prompt-injected retrieved text, oversized history/tool output | Server-derived identity/tenant wins; unauthorized action is denied; retrieved content is treated as untrusted |
| Headers / proxy / limits | Production-like frontend with API/LiveKit origins; direct and proxied requests; multiple instances | CSP loads only required origins; forwarded IPs cannot be forged; rate limits meet deployment intent |

## Execution guidance

1. Use generated synthetic users and per-run random signing secrets. Never print tokens, cookies, webhook secrets, or environment-file values.
2. Prefer mocked provider/network boundaries for unit tests; use isolated provider sandboxes only for callback/signature interoperability.
3. Keep database tests on disposable data. Restore mocks and test state; do not run destructive schema migrations.
4. Add every fixed finding as a negative regression test at the controller/service boundary, not only as a UI test.
5. Run normal unit/build/lint checks after any code change, then a small two-account integration suite for authorization changes.
6. Record skipped tests and missing dependencies as unverified; do not report them as passing.

## Not performed in this audit

No live browser login, authenticated production test, fuzzing, load test, exploit-chain exercise, live OAuth provider flow, live Polar event, R2 upload/download, or cross-account production test was run.
