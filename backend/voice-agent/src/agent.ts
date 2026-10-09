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

dotenv.config();

const REQUIRED_ENVIRONMENT = [
  'LIVEKIT_URL',
  'LIVEKIT_API_KEY',
  'LIVEKIT_API_SECRET',
  'WORKGRIND_BACKEND_URL',
] as const;

const missingEnvironment = REQUIRED_ENVIRONMENT.filter((name) => !process.env[name]?.trim());
if (missingEnvironment.length > 0) {
  console.error('[Tavro Voice Agent] Missing required environment variables.', {
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
          instructions: 'You are Tavro AI. Listen to the user and let the WorkGrind Tavro backend answer. Do not use a separate model or claim workspace actions outside backend confirmation.',
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
      console.info('[Tavro Voice Agent] Agent joined room.', {
        roomId: roomName,
        jobId,
        dispatchId,
        stage: 'agent_room_connect',
      });
      stage = 'greeting';
      await session.say('Hello, I am Tavro AI. How can I help you?');
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
