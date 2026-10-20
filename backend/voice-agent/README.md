# Tavro AI Voice Agent

This is the separate LiveKit Agents worker for WorkGrind's optional voice mode.
It uses LiveKit Inference for STT/TTS and sends final speech turns to the
existing authenticated WorkGrind Tavro backend runtime. The backend supplies
the configured AI provider, conversation persistence, workspace tools, plan
checks, and tool authorization; the worker does not implement a second AI
engine or access WorkGrind data directly.

## Required setup

Create a LiveKit Cloud project. For local development or a self-hosted worker,
configure:

- `LIVEKIT_URL`: the project's secure WebSocket URL (`wss://...`)
- `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET`: project credentials
- `WORKGRIND_BACKEND_URL`: the WorkGrind backend origin (HTTPS in production;
  `http://localhost` is supported for local development)

The worker exits during startup if any of these four variables are missing.
LiveKit Cloud injects `LIVEKIT_URL`, `LIVEKIT_API_KEY`, and
`LIVEKIT_API_SECRET` into deployed agents; do not upload or override those three
as LiveKit Cloud secrets.
`TAVRO_VOICE_AGENT_SECRET` is only required by the backend; the worker receives
the short-lived room-bound credential through private dispatch metadata and
forwards it to the backend.

Configure `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, and
`TAVRO_VOICE_AGENT_SECRET` in the WorkGrind backend environment as well.
Configure the same public `LIVEKIT_URL` as the frontend's
`NEXT_PUBLIC_LIVEKIT_URL`; this allows the production Content Security Policy
to permit the voice signaling connection to that LiveKit project.
`TAVRO_VOICE_AGENT_SECRET` must be a unique random value with at least 32
characters. The backend signs a short-lived credential bound to the user,
workspace, and LiveKit room, then sends it to the worker only through
server-to-server agent-dispatch metadata. The credential and secret are never
returned to the browser or logged. Configure the AI provider key/model only in
the backend, using the same settings as Tavro text chat. Keep secrets in the
respective service's secret manager or local ignored `.env`; never add them to
the frontend environment or commit them. LiveKit Inference must be available
for the project to use the configured AssemblyAI STT and Cartesia TTS.

Required environment by service:

```dotenv
# WorkGrind backend
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret
TAVRO_VOICE_AGENT_SECRET=<unique-random-value-at-least-32-characters>
# Keep the existing Tavro provider configuration here (for example GEMINI_API_KEY).

# LiveKit voice-agent worker
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret
WORKGRIND_BACKEND_URL=https://your-workgrind-backend.example.com
```

The backend endpoint `POST /api/ai/voice/session` requires an authenticated,
verified, active workspace member and the `aiAssistant` entitlement. The
worker calls `POST /api/ai/voice/turn` with a short-lived server-issued session
credential; every turn revalidates membership, subscription, entitlement, and
monthly usage. Workspace-changing tools require an explicit voice confirmation
and then run through the same workspace-scoped permissions as text chat. The
LiveKit participant token remains short-lived and microphone-only.

## Run locally in VS Code

In one terminal, start the backend with its existing `backend/.env` configured:

```powershell
cd C:\workgrind\backend
npm install
npm run dev
```

In a second terminal, configure `LIVEKIT_URL`, `LIVEKIT_API_KEY`,
`LIVEKIT_API_SECRET`, and `WORKGRIND_BACKEND_URL` in
`backend\voice-agent\.env` using the service-specific list above, then run:

```powershell
cd C:\workgrind\backend\voice-agent
npm install
npm run dev
```

In a third terminal, start the frontend with `NEXT_PUBLIC_API_URL` pointing to
the backend:

```powershell
cd C:\workgrind\frontend
npm install
npm run dev
```

The local browser must be opened over `localhost` or HTTPS for microphone access.
Use the app's Tavro AI page and select **Voice**. `npm run dev` runs the worker in
LiveKit Agents development mode; `npm run build` type-checks and emits the
production worker, and `npm start` starts that compiled worker in production
mode.

For production, deploy this directory as a LiveKit Cloud Agent. There is no
worker deployment configuration, `livekit.toml`, or Dockerfile in this
repository; the LiveKit CLI creates the initial agent configuration and
Dockerfile. The backend's [vercel.json](../vercel.json) configures serverless
API routes and does not deploy or keep this worker running.

From this directory, authenticate/select the same LiveKit Cloud project used by
the backend and create the initial deployment:

```powershell
lk cloud auth
lk project set-default "<your-livekit-project-name>"
lk agent create
```

The source registers the dispatch name `tavro-voice`; keep that name unchanged
because the backend explicitly dispatches to it. Add `WORKGRIND_BACKEND_URL` to
the LiveKit Agent's encrypted runtime secrets. Its value must be the actual
HTTPS **backend API origin** configured for this deployment (origin only; the
worker appends `/api/ai/voice/turn`). Do not substitute the frontend domain or
guess a backend URL. LiveKit Cloud supplies the three `LIVEKIT_*` variables
automatically. Keep `TAVRO_VOICE_AGENT_SECRET` and the configured Tavro AI
provider credentials only in the backend's secret store.

After making code changes or setting the secret, deploy from this directory and
verify the deployment and logs:

```powershell
lk agent deploy
lk agent status
lk agent logs
```

For a self-hosted persistent worker, set all four variables shown in the
worker example and run `npm run build` followed by `npm start`. The worker exits
before registering if required configuration is missing or malformed. A
successful backend dispatch response does not itself confirm that a worker
accepted or started the job. Follow LiveKit's
[Agent deployment guide](https://docs.livekit.io/deploy/agents/) and
[Agent dispatch guide](https://docs.livekit.io/agents/server/agent-dispatch/).

## Operations

- Tokens expire after five minutes if not used to connect.
- Voice session creation is rate limited, and each voice turn consumes one
  monthly AI request.
- The browser disconnects the room and stops microphone capture when the user
  ends the session or leaves the page. LiveKit reconnect events are surfaced in
  the UI; users can end and restart a failed connection.
- Backend, agent, and browser voice-panel logs include lifecycle stage, room
  correlation ID, participant kind, timeout/disconnect reason, and error class.
  They do not log credentials, access tokens, audio, or transcripts.
- The worker publishes user and Tavro speech transcriptions through LiveKit room
  transcription events. The browser renders those provider-generated events; it
  does not use browser speech recognition or synthetic transcript content.
- The worker marks itself ready only after `AgentSession.start()` succeeds and
  its explicit LiveKit participant-attribute update is acknowledged. A room
  connection or queued dispatch alone is not treated as Tavro readiness.
- If the member can join but Tavro does not, confirm the separately deployed
  `tavro-voice` worker is healthy and registered with the same LiveKit project.
  The worker requires LiveKit Inference access for its configured AssemblyAI STT
  and Cartesia TTS models; the Tavro AI provider remains configured on the backend.
- Voice mode is optional; existing Tavro text chat and its workspace tools are
  unchanged.
- The configured LiveKit STT/TTS providers determine language support.
  Tavro's backend prompts it to reply in English, Urdu script, or Roman Urdu
  matching the user's speech. Validate recognition and pronunciation with the
  actual LiveKit Inference account and selected Cartesia voice before production.
