import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import {
  AgentSessionEventTypes,
  ServerOptions,
  cli,
  defineAgent,
  inference,
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
    try {
      const voiceTurnToken = readVoiceTurnToken(ctx);
      const roomName = ctx.room.name;
      if (!roomName) throw new Error('Tavro voice dispatch is missing its room name.');
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

      await session.start({
        agent: voice.Agent.create({
          instructions: 'You are Tavro AI. Listen to the user and let the WorkGrind Tavro backend answer. Do not use a separate model or claim workspace actions outside backend confirmation.',
        }),
        room: ctx.room,
      });
      session.on(AgentSessionEventTypes.Error, (event) => {
        console.warn('[Tavro Voice Agent] Session operation failed.', {
          roomId: roomName,
          errorName: event.error instanceof Error ? event.error.name : 'UnknownError',
        });
      });
      await ctx.connect();
      await session.say('Hello, I am Tavro AI. How can I help you?');
    } catch (error) {
      console.error('[Tavro Voice Agent] Session failed.', {
        roomId: ctx.room.name,
        errorName: error instanceof Error ? error.name : 'UnknownError',
      });
      if (session) await session.close();
    }
  },
});

cli.runApp(new ServerOptions({
  agent: fileURLToPath(import.meta.url),
  agentName: AGENT_NAME,
}));
