export function getTrustedConnectionSources(apiUrl: string, liveKitUrl: string): string[] {
  const api = new URL(apiUrl);
  const liveKit = new URL(liveKitUrl);
  if (
    api.protocol !== 'https:' ||
    api.username ||
    api.password ||
    api.search ||
    api.hash ||
    (api.pathname !== '' && api.pathname !== '/' && api.pathname !== '/api' && api.pathname !== '/api/') ||
    liveKit.protocol !== 'wss:' ||
    liveKit.username ||
    liveKit.password ||
    liveKit.search ||
    liveKit.hash ||
    (liveKit.pathname !== '' && liveKit.pathname !== '/')
  ) {
    throw new Error('Production CSP API and LiveKit URLs must use HTTPS/WSS origins.');
  }

  return [
    api.origin,
    `wss://${api.host}`,
    liveKit.origin,
    `https://${liveKit.host}`,
    'stun:',
    'turn:',
    'turns:',
  ];
}
