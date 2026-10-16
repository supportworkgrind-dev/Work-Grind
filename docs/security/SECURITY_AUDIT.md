# WorkGrind Defensive Security Audit

**Scope:** Bounded source/configuration review of this repository. This is not an exhaustive penetration test. No production systems, real secrets, or destructive migrations were used.

## Architecture and finding map

| Boundary / capability | Main implementation | Audit focus |
|---|---|---|
| Web application | `frontend` (Next.js) | Session handling, private-page caching, security headers |
| API and persistence | `backend/src/index.ts`, Express routes/controllers, Mongoose | Authentication, tenant scoping, role checks, rate limits |
| Authentication | `middleware/auth.ts`, `controllers/auth.controller.ts`, `services/oauth.ts` | JWT/session lifecycle, MFA, OAuth state and identity binding |
| Workspaces | `middleware/organizationAccess.ts`, `models/Company.ts`, domain controllers | Organization/role isolation and cross-tenant object access |
| File storage | `middleware/upload.ts`, `controllers/file.controller.ts`, `services/r2Storage.ts` | Upload content/size controls, private object access, download authorization |
| Realtime | `utils/socket.ts`, `utils/socketAuthorization.ts` | Socket identity, room joins, per-event authorization and tenant boundaries |
| Tavro AI | `ai/tools.ts`, `controllers/aiAgent.controller.ts`, `tavro-ai/src` | Server-derived tool context, data boundaries, privileged tool actions |
| Billing / integrations | `controllers/subscription.controller.ts`, `routes/subscription.ts` | Webhook verification/idempotency, billing authorization, outbound callbacks |
| Verification | `backend/tests`, `frontend/tests`, Tavro tests, package scripts | Existing automated coverage and focused regression opportunities |

Findings and evidence below are limited to behavior verified in the inspected source and tests. Items not fully validated are labeled as unresolved or untested rather than passed.

## Executive summary

Two high-impact authorization defects were confirmed and fixed:

1. Workspace users could retrieve private-channel details and message history without being channel members. `getChannel` only constrained the tenant; `getMessages` constrained messages to the tenant but did not require a channel ID or authorize the requested channel. Both now require an active, same-tenant public channel or a channel that includes the requester. History requires a valid channel ID.
2. Academic file downloads did not apply the academic uploader/share visibility filter, and file deletion accidentally replaced the edit-permission filter with the broader view-permission filter. Download now applies view scope; deletion composes the edit scope without overwriting it.

Additional fixes make inbound integration HMAC mandatory, validate file signatures after multipart parsing, and limit Vercel proxy trust to one hop. Rate limiting uses the built-in `express-rate-limit` process-local store; separate serverless instances do not share counters. The vulnerable legacy local Transformers.js dependency was replaced, and audited high backend production dependencies were updated.

No claim is made that no other vulnerabilities exist. Deployment-dependent controls and the complete application-wide authorization matrix remain unverified.

## Verified findings and remediation

### WG-SEC-00 — Critical — Vulnerable backend proxy address parser (fixed)

- **Evidence:** The production dependency tree contained `proxy-addr` 2.0.7, affected by GHSA-jqcg-44mw-7w3h. The Express application trusts the Vercel proxy chain in `backend/src/index.ts`; a forged forwarded address can undermine IP-based controls when the affected IPv4-mapped IPv6 trust-subnet condition is met.
- **Fix:** Applied the lockfile-compatible patch with `npm audit fix`; `proxy-addr` is now 2.0.8. Vercel now trusts exactly one proxy hop instead of the full forwarded chain. No force install was used.
- **Validation:** Re-ran the backend build and full `tests/*.test.cjs` suite after the update. The production-dependency audit no longer reports this critical advisory.

### WG-SEC-01 — High — Private-channel content disclosure (fixed)

- **Evidence before fix:** `backend/src/controllers/channel.controller.ts` (`getChannel`) queried only by channel ID and `companyId`. `getMessages` queried by `companyId` and an optional `channelId`, with no membership check; omitting the channel ID could also return all company messages, including messages not appropriate for channel-history access.
- **Impact:** An authenticated workspace member could enumerate/fetch private-channel metadata and read message content by supplying an object ID; an unfiltered history request could include messages from multiple conversation contexts.
- **Fix:** Both reads now require a same-workspace, non-archived channel that is public or lists the requester as a member. Message history rejects missing/invalid channel IDs and does not query messages when channel authorization fails.
- **Regression evidence:** `backend/tests/security-boundaries.test.cjs` tests denial before message queries, private-channel detail filtering, and required channel ID.

### WG-SEC-02 — High — Academic file visibility/edit checks missing or overridden (fixed)

- **Evidence before fix:** `backend/src/controllers/file.controller.ts` already applied `getAcademicFileAccessScope` to file listings and updates, but `downloadFile` did not apply it. In `deleteFile`, object-spreading both the edit and view scopes used the same `$or` key, so the later, broader view scope replaced the edit scope.
- **Impact:** A same-workspace academic user could download an unshared file by ID; a user with view-only sharing could delete a file they were not allowed to edit.
- **Fix:** Downloads now apply the view scope; deletes retain the edit scope as an explicit conjunctive filter.
- **Regression evidence:** `backend/tests/security-boundaries.test.cjs` asserts the exact uploader/shared-view and uploader/shared-edit filters.

### WG-SEC-03 — Medium — Unsigned inbound integration webhook (fixed)

- **Evidence before fix:** `receiveWebhook` accepted requests without `X-Webhook-Signature`, treating the URL token as the only credential.
- **Fix:** All inbound requests now require a stored webhook secret and a matching, constant-time HMAC comparison.
- **Regression evidence:** Tests reject both absent and invalid signatures before emitting an event.

### WG-SEC-04 — Low/Medium — Client-declared upload type (fixed)

- **Evidence before fix:** General, avatar, and whiteboard uploads checked client MIME and extension but did not verify file bytes.
- **Fix:** Shared post-multipart validation now checks an allowlisted MIME/extension pair against signatures for image, PDF, Office/archive, media, and UTF-8 text formats.
- **Regression evidence:** Tests accept a valid PNG/PDF signature and reject mismatched or spoofed content. No malware-scanning claim is made.

### WG-SEC-05 — Medium — Serverless rate-limit isolation (mitigated)

- **Evidence before fix:** Vercel trusted all forwarded hops and the rate limiter used per-process memory.
- **Fix:** Vercel now trusts one proxy hop. The limiter enforces configured limits using the built-in process-local store.
- **Regression evidence:** Tests verify configured thresholds, route-specific messages, and skipped requests. Separate serverless instances do not share counters; production edge behavior still requires deployment verification.

### WG-SEC-06 — Critical — Legacy local AI dependency chain (fixed)

- **Evidence before fix:** `@xenova/transformers` brought in a vulnerable `protobufjs`/legacy ONNX dependency path.
- **Fix:** Local AI dynamic imports now use the already-installed `@huggingface/transformers`, and the legacy package was removed.
- **Validation:** The frontend production build passed; the production dependency audit no longer reports a Critical advisory. Remaining frontend advisories are listed below.

## Other reviewed boundaries

- **Authentication / authorization:** `backend/src/middleware/auth.ts` verifies access JWTs, rejects MFA-pending tokens, reloads active/verified/deleted state and the current workspace/role from MongoDB, and compares the token workspace. `requireSuperAdmin` separately checks persisted super-admin status and MFA completion when enabled. JWT helpers fail closed when secrets are absent. Password, reset, refresh, and OAuth edge cases were not exhaustively penetration-tested.
- **Tenant access:** Route groups generally use `authenticate` and organization/entitlement guards; inspected file, task, project, approval, academic, client portal, and billing queries commonly scope by tenant ID. This is not a proof that every query is isolated; the private-channel and file issues above show why object-level access also needs focused tests.
- **OAuth:** `backend/src/services/oauth.ts` implements fixed provider endpoints, state/nonce/PKCE, redirect-origin/path validation, HTTPS requirements in production, timed provider fetches, and OIDC validation. `backend/src/controllers/oauth.controller.ts` uses one-time exchanges and separate client-audience handling. Live provider behavior and real-account linking were not tested.
- **Uploads / R2:** `backend/src/middleware/upload.ts` applies size/file-count limits, MIME/extension allowlists, and content-signature checks for accepted image, document, archive, media, and text types after multipart parsing. File, avatar, and whiteboard upload routes use this check. No live R2 account or malware scanner was tested or claimed.
- **Socket.IO:** `backend/src/utils/socket.ts` verifies JWTs and persisted user/workspace/subscription context at connection, refreshes authorization, checks channel membership and DM participation for joins, and validates meeting grants before sensitive events. Realtime behavior was source-reviewed; this task did not run a live multi-user Socket.IO attack test.
- **Tavro AI:** `backend/src/controllers/aiAgent.controller.ts` derives user/company context server-side and looks up conversations by both owner and tenant. `backend/src/ai/tools.ts` scopes workspace data queries and includes role/feature checks for sensitive tools. Prompt injection and external-provider data handling were not red-teamed.
- **Billing:** `backend/src/controllers/subscription.controller.ts` checks Polar HMAC signatures using constant-time comparison, enforces a five-minute timestamp window, validates product/workspace plan mapping, and claims delivery IDs for idempotency. No live Polar event was sent.
- **Headers / caching:** Production frontend CSP is generated in `frontend/src/proxy.ts` with a per-request nonce and restrictive directives. The backend disables Helmet CSP in `backend/src/index.ts`; the backend primarily returns API data and does not serve the frontend. The service worker restricts navigation caching to an explicit public allowlist in `frontend/public/sw.js`.

## Verification references

The source review used the **OWASP ASVS 5.0.0** verification domains and the **OWASP API Security Top 10 (2023)** as checklists, not as a certification or exhaustive control-by-control assessment.

- **API1: Broken Object Level Authorization / ASVS access control:** verified channel membership and academic file access gaps and added regression tests for these specific cases. Other object types still require systematic two-tenant tests.
- **API2: Broken Authentication:** inspected JWT reload, OAuth state/nonce/PKCE, and refresh paths; no end-to-end provider or production session test was run.
- **API3/API5: Broken Object Property / Function Level Authorization:** selected role and update allowlists were inspected; complete endpoint and mass-assignment coverage remains unverified.
- **API4: Unrestricted Resource Consumption:** request/upload limits remain. Rate limiting uses shared Upstash counters when both REST settings are valid; Vercel rate-limited requests fail closed when they are missing or unavailable. Distributed production enforcement still depends on deployment configuration.
- **API7/API10: SSRF / Unsafe Consumption of APIs:** outbound integrations and external provider boundaries need further destination and response validation review; no live upstream exercise was performed.
- **API8/API9: Security Misconfiguration / Improper Inventory Management:** Vercel and environment-dependent controls were documented for operator verification; no live deployment configuration was accessed.
- **API6: Sensitive Business Flows:** OAuth and Polar protections were inspected, but no live provider or race/replay test was conducted.

## Dependency audit results

Dependency audits were run after the dependency changes:

- **Backend production tree:** 0 advisories after updating `agents`, Nodemailer, UUID, and compatible lockfile dependencies. The full tree including development dependencies still reports 3 High advisories (`ts-node-dev`, `braces`, and `chokidar`); npm reports no compatible automatic fixes.
- **Frontend production tree:** 16 advisories remain (6 High, 8 Moderate, 2 Low; 0 Critical). The Critical `protobufjs` and associated legacy ONNX dependency path were removed by migrating local AI imports from `@xenova/transformers` to the already-installed `@huggingface/transformers`; the production build passed. The remaining High findings include Excalidraw's dependency tree. npm's suggested Excalidraw fix downgrades to 0.17.6, whose peer range excludes this app's React 19, so that downgrade was not applied. Moderate/Low findings also remain in ExcelJS/Mermaid dependencies.
- **Full frontend tree:** 23 advisories remain (11 High, 10 Moderate, 2 Low), including production dependencies and lint/build tools. Forced major updates/downgrades were not applied without compatibility evidence.
- `npm audit fix` was run without `--force`; audited production fixes were made with normal compatible dependency updates and a maintained local AI runtime migration.

OWASP references: [ASVS 5.0.0](https://owasp.org/www-project-application-security-verification-standard/) and [API Security Top 10 (2023)](https://owasp.org/API-Security/editions/2023/en/0x11-t10/).

## Unresolved findings and validation gaps

Remaining items are deployment-dependent or require broader validation:

1. **Unverified billing integration.** Raw Polar webhook bytes are now captured by the global JSON parser's endpoint-specific `verify` callback and the route rejects requests without a captured buffer. Unit tests verify the exact bytes are preserved, but an actual signed Polar sandbox event through the deployed middleware path is still required.
2. **Deployment-dependent rate limiting.** Counters are process-local and are not coordinated across Vercel instances. Verify one-hop edge forwarding behavior and test request limits through the production proxy.
3. **Remaining frontend advisories.** Production audit reports 6 High, 8 Moderate, and 2 Low advisories. The suggested npm remediation for Excalidraw downgrades to a release incompatible with the React 19 peer range; ExcelJS/Mermaid and development-tool advisories also remain.
4. **Unverified billing reliability concern — Raw-body capture ordering.** `backend/src/index.ts` installs `express.json()` before mounting `subscriptionRoutes`; `backend/src/routes/subscription.ts` then installs `express.raw()` for the webhook and expects a Buffer. Validate an actual signed Polar test event in an isolated sandbox to ensure the raw bytes survive this middleware order. This is recorded as an integration test gap, not a confirmed signature bypass.
5. **Secret-handling follow-up.** A prior session reported local environment values appeared in tool output. No values are reproduced here and no rotation was performed; privately identify any affected credentials and rotate through their issuing providers/deployment control plane.
6. **Tooling gap.** `gitleaks`, `trufflehog`, and `semgrep` were unavailable. No source secret scan or SAST run is claimed.
7. **Coverage gap.** The added tests use mocked model queries and synthetic two-workspace object IDs; they do not provide disposable-database coverage across all resource families or prove Socket.IO multi-tenant isolation. No live OAuth/payment provider, R2, browser login, fuzzing, load, or penetration test was run.

## Prioritized follow-up plan

1. **P0 — Frontend dependencies:** resolve remaining Excalidraw High advisories with a React 19-compatible upstream release or a feature-tested replacement; assess ExcelJS/Mermaid paths without forced downgrades.
2. **P1 — Distributed limits:** configure and verify both Upstash REST variables in each Vercel environment; confirm the edge supplies an unspoofable one-hop client IP.
4. **P1 — Tenant coverage:** add disposable-database tests with two organizations and multiple roles across files, tasks/projects, CRM, academic records, channels, API routes, and socket events.
4. **P2 — Provider integration checks:** verify Polar raw-body/signature behavior with a sandbox event and exercise OAuth, R2, and realtime flows using test accounts.
5. **P2 — Completion evidence:** run the full ASVS 5.0.0/API Security Top 10 control matrix and add secret scanning/SAST to CI, recording exceptions rather than treating them as passed.

## Validation performed

- `Set-Location backend; npm run test:auth-refresh` — passed; 115 tests passed, 0 failed; includes TypeScript build.
- Frontend `npm run build` — passed with a temporary, non-secret, valid-format `NEXT_PUBLIC_LIVEKIT_URL`; generated all 103 pages. No deployment configuration was changed.
- Frontend `npm run lint` — failed with 349 errors and 214 warnings across the tree; lint cleanup was outside this security scope.
- `npm audit --omit=dev --json` — backend: 0 advisories; frontend: 16 advisories (6 High, 8 Moderate, 2 Low).
- `npm audit --json` — backend: 3 High development-tree advisories; frontend: 23 advisories (11 High, 10 Moderate, 2 Low).
- `gitleaks`, `trufflehog`, and `semgrep` were not installed in the environment; no source secret scan or SAST run is claimed.
- Tests use mocked model queries and do not connect to a database or external service.
