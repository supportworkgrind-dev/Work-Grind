# WorkGrind Deployment Security Checklist

Use this before each production release and after material changes to authentication, tenant authorization, storage, billing, or network configuration. Validate values through the secret manager or deployment control plane; do not print secret values into terminals, logs, tickets, or CI output.

## Identity and secrets

- [ ] Verify each environment variable is present only in the intended Vercel project/environment; use names and status only in audit records, never copy values into tickets or build logs.
- [ ] Redacted configuration inventory: backend-only `MONGODB_URI`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `CLIENT_JWT_SECRET`, `MFA_ENCRYPTION_KEY`, Google/LinkedIn/Apple OAuth private credentials, `EMAIL_PASS`/`SMTP_PASS`, `POLAR_ACCESS_TOKEN`/`POLAR_WEBHOOK_SECRET`, `R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY`, AI-provider tokens, `LIVEKIT_API_KEY`/`LIVEKIT_API_SECRET`, `CRON_SECRET`, `WAAPI_WEBHOOK_SECRET`, and `TAVRO_VOICE_AGENT_SECRET`; endpoint/non-secret settings include `BACKEND_URL`, `CLIENT_URL`, `CORS_ORIGINS`, OAuth callback URLs, and frontend `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_BASE_URL`, `NEXT_PUBLIC_LIVEKIT_URL`, and `NEXT_PUBLIC_SOCKET_URL`.
- [ ] Confirm `NEXT_PUBLIC_*` values contain no credentials; assume every such value is published in the client bundle.
- [ ] Configure independent, cryptographically random JWT access and refresh signing secrets per environment; verify they are not defaults, reused, committed, or included in client bundles.
- [ ] Store OAuth client secrets/private keys, Polar tokens/webhook secrets, email credentials, R2 keys, and AI-provider credentials only in protected backend runtime configuration.
- [ ] Restrict who can read/change production secrets; audit access and rotate after staff, vendor, or incident changes.
- [ ] A prior session reported that local environment values had appeared in tool output; identify any affected credentials privately and rotate them at their issuing providers/deployment control plane. No credentials were rotated during this task.
- [ ] Set access/refresh token lifetimes intentionally; verify logout, refresh-token rotation/revocation, MFA policy for administrators, and account-recovery controls.
- [ ] Ensure logs redact authorization headers, cookies, OAuth callback codes/state, webhook signatures, and provider credentials.

## Authentication and tenant boundaries

- [ ] Require HTTPS for frontend, API, OAuth callbacks, and externally accessible integration endpoints.
- [ ] Register exact provider callback URLs and redirect origins; keep production configuration aligned with the callback paths checked by `backend/src/services/oauth.ts`.
- [ ] Verify workspace roles and organization/entitlement gates on every sensitive API and object-level query; include both same-tenant unauthorized and cross-tenant tests.
- [ ] Test private channels, client portal identities, academic records, shared files, and meeting/call grants with separate synthetic roles.
- [ ] Confirm frontend private/API responses are not stored in shared CDN/browser caches; the service worker should cache only public allowlisted pages.

## Network, headers, and rate limiting

- [ ] Vercel code trusts exactly one proxy hop; verify the deployed edge overwrites client-supplied forwarding headers and that the request reaches the function through that hop.
- [ ] Optionally configure `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` as backend-only settings in every Vercel environment requiring shared limits. The REST URL must be HTTPS and both settings must be present together. Without a working Redis store, process-local limits remain enforced but are not shared across serverless instances. Test limits through the production proxy.
- [ ] Verify frontend production CSP nonce behavior and all required API/LiveKit connection origins; investigate browser CSP violations before relaxing directives.
- [ ] Confirm HSTS, `X-Content-Type-Options`, frame protections, Referrer Policy, and Permissions Policy on public frontend responses.
- [ ] Apply request/body/upload limits appropriate to memory and concurrency budgets; upload routes also validate file signatures. No malware scanning is configured or claimed.

## Database, realtime, and storage

- [ ] Use authenticated, TLS-protected database connections with network restrictions and a least-privilege runtime account.
- [ ] Verify backups, retention, restoration access, and alerting without exposing production records in tests.
- [ ] Keep the R2 bucket private; use least-privilege bucket credentials, rotate them, and restrict bucket CORS to known frontend origins where browser access is required.
- [ ] Confirm signed object URLs are short-lived and issued only after tenant/object authorization; remove or protect local-upload fallback storage in production deployments where it is not persistent/private.
- [ ] Verify Socket.IO tokens, room membership, tenant isolation, and revocation behavior against the configured shared adapter.

## OAuth, billing, AI, and integrations

- [ ] Exercise OAuth state, nonce, PKCE, audience, email verification, account-link collisions, and callback URL validation in a provider test environment.
- [ ] Send a real signed Polar sandbox webhook through the deployed middleware path; confirm raw-body signature verification, timestamp rejection, replay idempotency, product mapping, and retry behavior before enabling production events.
- [ ] Keep billing product IDs and environment-specific credentials separate; test plan changes and cancellations without production workspaces.
- [ ] Require authenticated/authorized AI tool context from the server; review external-provider retention and data-processing terms before enabling sensitive workspace content.
- [ ] Treat configured webhook URLs and inbound tokens as credentials. Prefer mandatory HMAC signing for inbound integration events; rotate tokens/secrets after exposure.
- [ ] Validate any outbound integration URL policy against SSRF and internal-network access before enabling delivery from backend infrastructure.

## Verification and incident readiness

- [ ] Run backend build and focused auth, tenant, socket, AI, OAuth, upload, and billing regression suites on every release.
- [ ] Verify alerts for failed login spikes, authorization denials, webhook failures, rate limits, storage errors, and unusual admin actions.
- [ ] Maintain documented procedures to revoke user sessions/OAuth grants, rotate signing/provider secrets, disable a compromised integration, and preserve relevant logs.
- [ ] Confirm security contact, vulnerability intake, escalation owner, and backup incident responders.
- [ ] Record checks not performed and environment limitations; do not equate a successful build or smoke test with exhaustive security validation.
