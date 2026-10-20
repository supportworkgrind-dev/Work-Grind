# WorkGrind MCP

WorkGrind exposes a stateless MCP Streamable HTTP endpoint at `/mcp` from the
existing backend application. It is served by the same Vercel Node function as
the backend API; it is not a persistent worker or a separate AI service.

## Authentication and authorization

Every MCP HTTP request must include an `Authorization` header using the
`Bearer` scheme and a short-lived access token issued through the normal
WorkGrind sign-in flow. Refresh tokens and service-wide shared credentials are
not accepted. The endpoint does not implement MCP OAuth 2.1 authorization
discovery, so clients must support a configured bearer token.

Authentication reloads the active WorkGrind user and workspace membership.
Calls also require the AI entitlement and organization-level AI access. Tool
availability and execution use the current user's verified role, workspace,
plan entitlements, monthly AI usage allowance, and existing tool handlers.
Workspace and user identifiers are never accepted as tool arguments.

The backend's configured client-origin allowlist is enforced when a request has
an `Origin` header. Server-to-server MCP clients without an `Origin` header are
allowed, subject to bearer authentication.

## Exposed tools

The server advertises the following tools only when the authenticated user's
workspace and role permit them:

- `searchTasks`, `getTaskDetails`, `createTask`, and `updateTask`
- `searchProjects`
- `searchContacts` and `getContactDetails` for eligible business CRM roles
- `searchCalendarEvents`
- `listWorkflows` for eligible business automation roles
- `getWorkspaceSummary` and `getWorkgrindCapabilities`

Task and CRM reads retain tenant scoping and record-level checks from the shared
tool registry. Workflow output omits action configuration and execution
payloads. Writes use the existing task handlers; destructive actions are not
exposed.

## Existing assistants

WorkGrind Text AI (`/api/ai/agent`) and Tavro Voice AI
(`/api/ai/voice/turn`) continue using `runAgentTurn` and the native WorkGrind
tool registry. The registry is the shared implementation behind those paths
and MCP, so their existing provider, conversation, streaming, voice readiness,
and confirmation behavior remains in place. The assistants do not make a
network call to `/mcp` or use a shared privileged MCP credential.

## Deployment and client setup

1. Deploy the backend application using its existing deployment configuration.
   `backend/vercel.json` maps `/mcp` to the existing `backend/api/index.ts`
   handler; it does not deploy or change the separate LiveKit voice worker.
2. Configure an MCP client with the HTTPS origin of the actual deployed backend
   and the `/mcp` path, plus a WorkGrind access token for the signed-in user.
   The repository does not establish the production backend hostname; verify
   it in the backend deployment settings rather than assuming it is the
   frontend's `workgrind.vercel.app` origin.
3. Do not place the access token in browser source, public environment
   variables, client-side logs, or shared deployment configuration. A backend
   integration must obtain or forward the appropriate user's own access
   context.
4. No MCP-specific environment variable is introduced. The existing backend
   MongoDB, JWT, subscription, and CORS/client-origin configuration remains
   required.

The endpoint uses a new server and transport per request and does not preserve
MCP sessions between requests, which fits the repository's serverless backend
deployment. MCP protocol compatibility and access should be smoke-tested on
the deployed backend after deployment; production connectivity is not verified
by a local build.
