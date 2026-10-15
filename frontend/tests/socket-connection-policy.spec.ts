import { expect, test } from '@playwright/test';
import { SOCKET_RECONNECTION_OPTIONS } from '../src/lib/socket';

test('Socket.IO retries use finite attempts and capped exponential backoff', () => {
  expect(Number.isFinite(SOCKET_RECONNECTION_OPTIONS.reconnectionAttempts)).toBe(true);
  expect(SOCKET_RECONNECTION_OPTIONS.reconnectionAttempts).toBeGreaterThan(0);
  expect(SOCKET_RECONNECTION_OPTIONS.reconnectionDelay).toBeGreaterThan(0);
  expect(SOCKET_RECONNECTION_OPTIONS.reconnectionDelayMax).toBeGreaterThan(
    SOCKET_RECONNECTION_OPTIONS.reconnectionDelay,
  );
  expect(SOCKET_RECONNECTION_OPTIONS.reconnectionDelayMax).toBeLessThanOrEqual(30_000);
  expect(SOCKET_RECONNECTION_OPTIONS.randomizationFactor).toBeGreaterThan(0);
});
