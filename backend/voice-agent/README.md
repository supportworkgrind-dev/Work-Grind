# Tavro AI Voice Agent

This is the separate LiveKit Agents worker for WorkGrind's optional voice mode.
It uses LiveKit Inference for STT/TTS and WorkGrind's configured Gemini model
for LLM responses. It does not read workspace records or perform actions;
workspace-aware tasks remain available in Tavro text chat.

## Required setup

Create a LiveKit Cloud project and configure:

- `LIVEKIT_URL`: the project's secure WebSocket URL (`wss://...`)
- `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET`: project credentials
- `GEMINI_API_KEY`: the same Gemini provider key used by the WorkGrind backend
- `GEMINI_MODEL`: the model name already selected for WorkGrind AI

Configure `LIVEKIT_URL`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET` in the
WorkGrind backend environment as well. Keep every secret in the respective
service's secret manager or local ignored `.env`; never add them to the frontend
environment or commit them. LiveKit Inference must be available for the project
to use AssemblyAI STT and Cartesia TTS. The Gemini key is only used by this
server-side worker.

The backend endpoint `POST /api/ai/voice/session` requires an authenticated,
verified, active workspace member, the `aiAssistant` entitlement, and remaining
monthly AI usage. Each issued voice session reserves one monthly AI request.
Its short-lived token allows microphone audio only and dispatches the
`tavro-voice` agent.

## Run locally in VS Code

In one terminal, start the backend with its existing `backend/.env` configured:

```powershell
cd C:\workgrind\backend
npm install
npm run dev
```

In a second terminal, configure the worker secrets in
`backend\voice-agent\.env` using `.env.example` as the variable-name template,
then run:

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

For production, deploy this directory as a LiveKit Agent named `tavro-voice` and
configure the variables above as deployment secrets. Configure the backend
secrets in the backend's runtime separately. Follow LiveKit's
[Agent deployment guide](https://docs.livekit.io/deploy/agents/) and
[Agent dispatch guide](https://docs.livekit.io/agents/server/agent-dispatch/).

## Operations

- Tokens expire after five minutes if not used to connect.
- Voice session creation is rate limited, and each issued session consumes one
  monthly AI request.
- The browser disconnects the room and stops microphone capture when the user
  ends the session or leaves the page. LiveKit reconnect events are surfaced in
  the UI; users can end and restart a failed connection.
- Backend and agent logs include status, room correlation ID, and error class
  only. They do not log credentials, access tokens, audio, or transcripts.
- Voice mode is optional; existing Tavro text chat and its workspace tools are
  unchanged.
