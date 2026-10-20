import { expect, test } from '@playwright/test';
import {
  AGENT_NAME,
  AGENT_NAME_ATTRIBUTE,
  AGENT_READY_ATTRIBUTE,
  AGENT_STATE_ATTRIBUTE,
  inspectTavroReadiness,
} from '../src/components/ai/voiceReadiness';

test('delayed Tavro participant arrival remains unready until identity, ready signal, and active state exist', () => {
  expect(inspectTavroReadiness(undefined)).toMatchObject({
    ready: false,
    failure: 'participant_not_joined',
  });

  const participant = { attributes: {} as Record<string, string> };
  participant.attributes[AGENT_NAME_ATTRIBUTE] = AGENT_NAME;
  expect(inspectTavroReadiness(participant)).toMatchObject({
    isTavro: true,
    ready: false,
    failure: 'ready_signal_missing',
  });

  participant.attributes[AGENT_READY_ATTRIBUTE] = 'true';
  expect(inspectTavroReadiness(participant)).toMatchObject({
    isTavro: true,
    ready: false,
    failure: 'active_state_missing',
  });

  participant.attributes[AGENT_STATE_ATTRIBUTE] = 'listening';
  expect(inspectTavroReadiness(participant)).toEqual({
    isTavro: true,
    ready: true,
    state: 'listening',
    failure: null,
  });

  const readinessBeforeIdentity = {
    attributes: {
      [AGENT_READY_ATTRIBUTE]: 'true',
      [AGENT_STATE_ATTRIBUTE]: 'listening',
    } as Record<string, string>,
  };
  expect(inspectTavroReadiness(readinessBeforeIdentity)).toMatchObject({
    ready: false,
    failure: 'agent_identity_missing',
  });
  readinessBeforeIdentity.attributes[AGENT_NAME_ATTRIBUTE] = AGENT_NAME;
  expect(inspectTavroReadiness(readinessBeforeIdentity)).toMatchObject({
    ready: true,
    state: 'listening',
    failure: null,
  });
});

test('a Tavro readiness signal is rejected until its active state is published', () => {
  const participant = {
    attributes: {
      [AGENT_NAME_ATTRIBUTE]: AGENT_NAME,
      [AGENT_READY_ATTRIBUTE]: 'true',
      [AGENT_STATE_ATTRIBUTE]: 'initializing',
    },
  };

  expect(inspectTavroReadiness(participant)).toMatchObject({
    isTavro: true,
    ready: false,
    state: null,
    failure: 'active_state_missing',
  });
});

test('a different agent cannot satisfy the Tavro readiness check', () => {
  const participant = {
    attributes: {
      [AGENT_NAME_ATTRIBUTE]: 'another-agent',
      [AGENT_READY_ATTRIBUTE]: 'true',
      [AGENT_STATE_ATTRIBUTE]: 'listening',
    },
  };

  expect(inspectTavroReadiness(participant)).toMatchObject({
    isTavro: false,
    ready: false,
    state: 'listening',
    failure: 'agent_identity_missing',
  });
});
