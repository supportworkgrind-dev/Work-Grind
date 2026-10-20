export const AGENT_NAME_ATTRIBUTE = 'lk.agent.name';
export const AGENT_NAME = 'tavro-voice';
export const AGENT_STATE_ATTRIBUTE = 'lk.agent.state';
export const AGENT_READY_ATTRIBUTE = 'workgrind.tavro.ready';

export type ActiveAgentStatus = 'listening' | 'thinking' | 'speaking';
export type AgentReadinessFailure =
  | 'participant_not_joined'
  | 'agent_identity_missing'
  | 'ready_signal_missing'
  | 'active_state_missing';

export type AgentReadiness = {
  isTavro: boolean;
  ready: boolean;
  state: ActiveAgentStatus | null;
  failure: AgentReadinessFailure | null;
};

type ParticipantAttributes = {
  attributes: Record<string, string>;
};

export function isTavroParticipant(participant: ParticipantAttributes): boolean {
  return participant.attributes[AGENT_NAME_ATTRIBUTE] === AGENT_NAME;
}

export function inspectTavroReadiness(
  participant: ParticipantAttributes | null | undefined,
): AgentReadiness {
  if (!participant) {
    return {
      isTavro: false,
      ready: false,
      state: null,
      failure: 'participant_not_joined',
    };
  }

  const isTavro = isTavroParticipant(participant);
  const value = participant.attributes[AGENT_STATE_ATTRIBUTE];
  const state: ActiveAgentStatus | null =
    value === 'listening' || value === 'thinking' || value === 'speaking' ? value : null;

  if (!isTavro) {
    return { isTavro, ready: false, state, failure: 'agent_identity_missing' };
  }
  if (participant.attributes[AGENT_READY_ATTRIBUTE] !== 'true') {
    return { isTavro, ready: false, state, failure: 'ready_signal_missing' };
  }
  if (!state) {
    return { isTavro, ready: false, state, failure: 'active_state_missing' };
  }

  return { isTavro, ready: true, state, failure: null };
}
