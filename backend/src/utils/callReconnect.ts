const disconnectTimers = new Map<string, NodeJS.Timeout>();
export const CALL_RECONNECT_GRACE_MS = 180_000;

export function clearCallReconnectCleanup(key: string): void {
  const timer = disconnectTimers.get(key);
  if (timer) clearTimeout(timer);
  disconnectTimers.delete(key);
}

export function scheduleCallReconnectCleanup(
  key: string,
  cleanup: () => void | Promise<void>,
  delayMs: number,
): void {
  clearCallReconnectCleanup(key);
  const timer = setTimeout(() => {
    if (disconnectTimers.get(key) !== timer) return;
    disconnectTimers.delete(key);
    void cleanup();
  }, delayMs);
  timer.unref?.();
  disconnectTimers.set(key, timer);
}
