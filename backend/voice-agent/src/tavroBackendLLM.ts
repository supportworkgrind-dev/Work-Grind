import { randomUUID } from 'node:crypto';
import {
  DEFAULT_API_CONNECT_OPTIONS,
  LLM,
  LLMStream,
  type APIConnectOptions,
  type ChatChunk,
  type ChatContext,
  type ToolChoice,
} from '@livekit/agents';

interface VoiceTurnResponse {
  success: boolean;
  reply?: string;
  conversationId?: string;
}

interface StreamOptions {
  chatCtx: ChatContext;
  connOptions: APIConnectOptions;
}

function latestUserMessage(chatCtx: ChatContext): string {
  const lastUserMessage = [...chatCtx.items].reverse().find(
    (item) => item.type === 'message' && item.role === 'user',
  );
  if (!lastUserMessage || lastUserMessage.type !== 'message') return '';
  return lastUserMessage.textContent?.trim() ?? '';
}

class TavroBackendLLMStream extends LLMStream {
  constructor(
    llm: LLM,
    options: StreamOptions,
    private readonly voiceTurnToken: string,
    private readonly roomName: string,
    private readonly backendUrl: string,
    private readonly onConversationId: (id: string) => void,
    private readonly getConversationId: () => string | undefined,
  ) {
    super(llm, options);
  }

  protected async run(): Promise<void> {
    const message = latestUserMessage(this.chatCtx);
    if (!message) throw new Error('Tavro did not receive a final speech transcript.');

    const controllerSignal = this.abortController.signal;
    const timeoutSignal = AbortSignal.timeout(55_000);
    const signal = AbortSignal.any([controllerSignal, timeoutSignal]);
    let response: Response;
    try {
      response = await fetch(new URL('/api/ai/voice/turn', this.backendUrl), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.voiceTurnToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomName: this.roomName,
          message,
          conversationId: this.getConversationId(),
        }),
        signal,
      });
    } catch {
      if (signal.aborted) throw new Error('Tavro voice request was cancelled or timed out.');
      this.emitSafeMessage('I could not reach WorkGrind right now. Please check your connection and try again.');
      return;
    }

    if (!response.ok) {
      const messageByStatus: Record<number, string> = {
        401: 'The Tavro voice session expired. Start a new session.',
        403: 'Tavro AI access is unavailable for this workspace. Contact your workspace administrator.',
        429: 'Tavro AI is receiving too many requests. Please wait and try again.',
        503: 'Tavro AI is temporarily unavailable. Please try again shortly.',
      };
      this.emitSafeMessage(messageByStatus[response.status] ?? 'Tavro could not complete that request. Please try again.');
      return;
    }

    let result: VoiceTurnResponse;
    try {
      result = await response.json() as VoiceTurnResponse;
    } catch {
      this.emitSafeMessage('Tavro returned an invalid response. Please try again.');
      return;
    }
    if (!result.success || typeof result.reply !== 'string' || !result.reply.trim()) {
      this.emitSafeMessage('Tavro could not complete that request. Please try again.');
      return;
    }
    if (typeof result.conversationId === 'string') this.onConversationId(result.conversationId);

    this.emitSafeMessage(result.reply);
  }

  private emitSafeMessage(content: string): void {
    if (this.abortController.signal.aborted) return;
    const chunk: ChatChunk = {
      id: randomUUID(),
      delta: { role: 'assistant', content },
    };
    this.queue.put(chunk);
  }
}

export class TavroBackendLLM extends LLM {
  private conversationId?: string;

  constructor(
    private readonly voiceTurnToken: string,
    private readonly roomName: string,
    private readonly backendUrl: string,
  ) {
    super();
  }

  label(): string {
    return 'workgrind-tavro-backend';
  }

  get provider(): string {
    return 'workgrind';
  }

  get model(): string {
    return 'tavro-agent-runtime';
  }

  chat(options: {
    chatCtx: ChatContext;
    connOptions?: APIConnectOptions;
    toolChoice?: ToolChoice;
  }): LLMStream {
    return new TavroBackendLLMStream(
      this,
      {
        chatCtx: options.chatCtx,
        connOptions: {
          ...DEFAULT_API_CONNECT_OPTIONS,
          ...options.connOptions,
          maxRetry: 0,
        },
      },
      this.voiceTurnToken,
      this.roomName,
      this.backendUrl,
      (id) => { this.conversationId = id; },
      () => this.conversationId,
    );
  }
}
