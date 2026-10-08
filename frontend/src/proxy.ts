import { randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

function createContentSecurityPolicy(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://backend-rho-vert-59.vercel.app http://localhost:5000 wss://workgrind.app wss://*.workgrind.app wss://*.devtunnels.ms ws://localhost:* ws://127.0.0.1:* stun: turn: turns:",
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
