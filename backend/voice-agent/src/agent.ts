import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import {
  AgentSessionEventTypes,
  ServerOptions,
  cli,
  defineAgent,
  inference,
  logMetrics,
  voice,
  type JobContext,
} from '@livekit/agents';
import { TavroBackendLLM } from './tavroBackendLLM.js';
import { publishTavroReady } from './readiness.js';

dotenv.config();

const REQUIRED_ENVIRONMENT = [
  'LIVEKIT_URL',
  'LIVEKIT_API_KEY',
  'LIVEKIT_API_SECRET',
  'WORKGRIND_BACKEND_URL',
] as const;

const missingEnvironment: string[] = REQUIRED_ENVIRONMENT.filter((name) => !process.env[name]?.trim());
function isValidLiveKitUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'wss:' &&
      (url.pathname === '/' || url.pathname === '') &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash;
  } catch {
    return false;
  }
}

function isValidBackendUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    const localDevelopment =
      process.env.NODE_ENV !== 'production' &&
      url.protocol === 'http:' &&
      ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    return (url.protocol === 'https:' || localDevelopment) &&
      (url.pathname === '/' || url.pathname === '') &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash;
  } catch {
    return false;
  }
}

if (!missingEnvironment.includes('LIVEKIT_URL') && !isValidLiveKitUrl(process.env.LIVEKIT_URL?.trim())) {
  missingEnvironment.push('LIVEKIT_URL (must be a secure wss:// URL)');
}
if (!missingEnvironment.includes('WORKGRIND_BACKEND_URL') &&
    !isValidBackendUrl(process.env.WORKGRIND_BACKEND_URL?.trim())) {
  missingEnvironment.push('WORKGRIND_BACKEND_URL (must be an HTTPS backend origin in production)');
}
if (missingEnvironment.length > 0) {
  console.error('[Tavro Voice Agent] Required worker configuration is missing or invalid.', {
    missingEnvironment,
  });
  process.exit(1);
}

const AGENT_NAME = 'tavro-voice';

console.info('[Tavro Voice Agent] Worker process starting.', {
  agentName: AGENT_NAME,
});

function readVoiceTurnToken(ctx: JobContext): string {
  try {
    const dispatch = JSON.parse(ctx.job.metadata) as { voiceTurnToken?: unknown };
    if (typeof dispatch.voiceTurnToken === 'string' && dispatch.voiceTurnToken.length > 0) {
      return dispatch.voiceTurnToken;
    }
  } catch {
    // Dispatch metadata is private server-to-server state; do not include it in logs.
  }
  throw new Error('Tavro voice dispatch is missing its session credential.');
}

export default defineAgent({
  entry: async (ctx: JobContext) => {
    let session: voice.AgentSession | undefined;
    const roomName = ctx.room.name;
    const jobId = ctx.job.id;
    const dispatchId = ctx.job.dispatchId;
    let stage = 'dispatch_credential_validation';
    console.info('[Tavro Voice Agent] Job assigned.', {
      roomId: roomName,
      jobId,
      dispatchId,
      agentName: ctx.job.agentName,
    });
    try {
      const voiceTurnToken = readVoiceTurnToken(ctx);
      if (!roomName) throw new Error('Tavro voice dispatch is missing its room name.');
      stage = 'provider_setup';
      session = new voice.AgentSession({
        stt: new inference.STT({
          model: 'assemblyai/universal-3-6-pro',
        }),
        llm: new TavroBackendLLM(
          voiceTurnToken,
          roomName,
          process.env.WORKGRIND_BACKEND_URL!.trim(),
        ),
        tts: new inference.TTS({
          model: 'cartesia/sonic-3',
          voice: '9626c31c-bec5-4cca-baa8-f8ba9e84c8bc',
        }),
        turnHandling: {
          turnDetection: new inference.TurnDetector(),
        },
      });

      session.on(AgentSessionEventTypes.Error, (event) => {
        console.warn('[Tavro Voice Agent] Session operation failed.', {
          roomId: roomName,
          jobId,
          dispatchId,
          stage: 'session_operation',
          errorName: event.error instanceof Error ? event.error.name : 'UnknownError',
        });
      });
      session.on(AgentSessionEventTypes.Close, (event) => {
        console.info('[Tavro Voice Agent] Session closed.', {
          roomId: roomName,
          jobId,
          dispatchId,
          reason: event.reason,
          errorName: event.error instanceof Error ? event.error.name : undefined,
        });
      });
      session.on(AgentSessionEventTypes.MetricsCollected, (event) => {
        console.info('[Tavro Voice Agent] Agent metrics collected.', {
          roomId: roomName,
          jobId,
          dispatchId,
          metricType: event.metrics.type,
        });
        logMetrics(event.metrics);
      });

      stage = 'session_initialization';
      await session.start({
        agent: voice.Agent.create({
          instructions: 'You are Tavro AI. Wait for the user to speak, then let the WorkGrind Tavro backend answer in the language and writing style of that latest message. Do not use a separate model or claim workspace actions outside backend confirmation.',
        }),
        room: ctx.room,
      });
      console.info('[Tavro Voice Agent] Session initialized.', {
        roomId: roomName,
        jobId,
        dispatchId,
        stage: 'session_initialization',
      });
      stage = 'agent_room_connect';
      const localParticipant = ctx.room.localParticipant;
      if (!localParticipant) throw new Error('Tavro voice agent did not connect to its assigned room.');
      stage = 'readiness_signal';
      await publishTavroReady(localParticipant);
      console.info('[Tavro Voice Agent] Readiness signal published.', {
        roomId: roomName,
        jobId,
        dispatchId,
        stage,
      });
      console.info('[Tavro Voice Agent] Agent joined room.', {
        roomId: roomName,
        jobId,
        dispatchId,
        stage: 'agent_room_connect',
      });
      stage = 'awaiting_user';
    } catch (error) {
      console.error('[Tavro Voice Agent] Session failed.', {
        roomId: roomName,
        jobId,
        dispatchId,
        stage,
        errorName: error instanceof Error ? error.name : 'UnknownError',
      });
      if (session) {
        try {
          await session.close();
        } catch (closeError) {
          console.error('[Tavro Voice Agent] Session cleanup failed.', {
            roomId: roomName,
            jobId,
            dispatchId,
            stage: 'session_cleanup',
            errorName: closeError instanceof Error ? closeError.name : 'UnknownError',
          });
        }
      }
      throw error;
    }
  },
});

cli.runApp(new ServerOptions({
  agent: fileURLToPath(import.meta.url),
  agentName: AGENT_NAME,
}));
