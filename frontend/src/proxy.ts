import { randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

function getTrustedConnectionSources(): string[] {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  const liveKitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL?.trim();
  if (!apiUrl || !liveKitUrl) {
    throw new Error('Production CSP requires NEXT_PUBLIC_API_URL and NEXT_PUBLIC_LIVEKIT_URL.');
  }

  const api = new URL(apiUrl);
  const liveKit = new URL(liveKitUrl);
  if (
    api.protocol !== 'https:' ||
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
    liveKit.origin,
    `https://${liveKit.host}`,
    'stun:',
    'turn:',
    'turns:',
  ];
}

function createContentSecurityPolicy(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self' ${getTrustedConnectionSources().join(' ')}`,
    "media-src 'self' blob: data:",
    "worker-src 'self' blob:",
    "frame-src 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "manifest-src 'self'",
    'upgrade-insecure-requests',
  ].join('; ');
}

export function proxy(request: NextRequest) {
  if (process.env.NODE_ENV !== 'production') {
    return NextResponse.next();
  }

  const nonce = randomBytes(16).toString('base64');
  const contentSecurityPolicy = createContentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);

  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', contentSecurityPolicy);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set('Content-Security-Policy', contentSecurityPolicy);
  return response;
}

export const config = {
  matcher: [
    '/((?!api(?:/|$)|socket\\.io(?:/|$)|_next/static|_next/image|favicon\\.ico|sw\\.js|manifest\\.json).*)',
  ],
};
