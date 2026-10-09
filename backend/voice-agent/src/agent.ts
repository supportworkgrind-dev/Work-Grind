import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import {
  ServerOptions,
  cli,
  defineAgent,
  inference,
  voice,
  type JobContext,
} from '@livekit/agents';
import * as google from '@livekit/agents-plugin-google';

dotenv.config();

const REQUIRED_ENVIRONMENT = [
  'LIVEKIT_URL',
  'LIVEKIT_API_KEY',
  'LIVEKIT_API_SECRET',
  'GEMINI_API_KEY',
] as const;

const missingEnvironment = REQUIRED_ENVIRONMENT.filter((name) => !process.env[name]?.trim());
if (missingEnvironment.length > 0) {
  console.error('[Tavro Voice Agent] Missing required environment variables.', {
    missingEnvironment,
  });
  process.exit(1);
}

const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash';
const AGENT_NAME = 'tavro-voice';

function createTavroAgent(): ReturnType<typeof voice.Agent.create> {
  return voice.Agent.create({
    instructions: `You are Tavro AI, WorkGrind's friendly voice assistant. Be concise, natural, and easy to understand when spoken aloud. Use plain spoken language without markdown, emojis, or lists unless the user asks for them. You can answer general questions, but this voice session has no access to WorkGrind workspace records or actions. Never claim that you read, changed, or created workspace data. If the user asks for workspace-specific information or an action, direct them to Tavro's text chat, where authorized workspace tools are available. Never ask for or reveal passwords, tokens, API keys, or other credentials.`,
  });
}

export default defineAgent({
  entry: async (ctx: JobContext) => {
    const session = new voice.AgentSession({
      stt: new inference.STT({
        model: 'assemblyai/universal-3-6-pro',
      }),
      llm: new google.LLM({
        model: GEMINI_MODEL,
        apiKey: process.env.GEMINI_API_KEY,
      }),
      tts: new inference.TTS({
        model: 'cartesia/sonic-3',
        voice: '9626c31c-bec5-4cca-baa8-f8ba9e84c8bc',
      }),
      turnHandling: {
        turnDetection: new inference.TurnDetector(),
      },
    });

    try {
      await session.start({
        agent: createTavroAgent(),
        room: ctx.room,
      });
      await ctx.connect();
      await session.generateReply({
        instructions: 'Greet the user as Tavro AI and briefly offer your help.',
      });
    } catch (error) {
      console.error('[Tavro Voice Agent] Session failed.', {
        roomId: ctx.room.name,
        errorName: error instanceof Error ? error.name : 'UnknownError',
      });
    }
  },
});

cli.runApp(new ServerOptions({
  agent: fileURLToPath(import.meta.url),
  agentName: AGENT_NAME,
}));
