export const TAVRO_AGENT_STATE_ATTRIBUTE = 'lk.agent.state';
export const TAVRO_AGENT_READY_ATTRIBUTE = 'workgrind.tavro.ready';

export interface AgentAttributePublisher {
  setAttributes(attributes: Record<string, string>): Promise<void>;
}

export async function publishTavroReady(publisher: AgentAttributePublisher): Promise<void> {
  await publisher.setAttributes({
    [TAVRO_AGENT_STATE_ATTRIBUTE]: 'listening',
    [TAVRO_AGENT_READY_ATTRIBUTE]: 'true',
  });
}
