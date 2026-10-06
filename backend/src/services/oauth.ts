import {
  createHash,
  createPrivateKey,
  createPublicKey,
  randomBytes,
  sign,
  timingSafeEqual,
  verify,
} from 'crypto';
import { OAuthProvider } from '../models/OAuthTransaction';

type OidcClaims = {
  sub: string;
  email?: string;
  email_verified?: boolean | string;
  name?: string;
  picture?: string;
  nonce?: string;
  iss?: string;
  aud?: string | string[];
  azp?: string;
  exp?: number;
  iat?: number;
};

type OAuthConfiguration = {
  clientId: string;
  clientSecret?: string;
  callbackUrl: string;
};

export class OAuthServiceError extends Error {
  constructor(
    readonly diagnosticCode: 'token_endpoint_rejected' | 'token_response_invalid' | 'jwks_endpoint_rejected' | 'provider_keys_invalid',
    readonly httpStatus?: number,
  ) {
    super(diagnosticCode);
  }
}

const providers: Record<OAuthProvider, {
  issuer: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  jwksEndpoint: string;
}> = {
  google: {
    issuer: 'https://accounts.google.com',
    authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenEndpoint: 'https://oauth2.googleapis.com/token',
    jwksEndpoint: 'https://www.googleapis.com/oauth2/v3/certs',
  },
  apple: {
    issuer: 'https://appleid.apple.com',
    authorizationEndpoint: 'https://appleid.apple.com/auth/authorize',
    tokenEndpoint: 'https://appleid.apple.com/auth/token',
    jwksEndpoint: 'https://appleid.apple.com/auth/keys',
  },
};

const base64Url = (value: Buffer | string) =>
  Buffer.from(value).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const randomToken = () => randomBytes(32).toString('base64url');

export const hashOAuthValue = sha256;
export const createOAuthToken = randomToken;

export function getOAuthConfigurationIssue(provider: OAuthProvider): string | null {
  const backendUrl = process.env.BACKEND_URL?.trim();
  if (!backendUrl) return 'BACKEND_URL is missing.';
  const redirectUri = (provider === 'google'
    ? process.env.GOOGLE_REDIRECT_URI
    : process.env.APPLE_REDIRECT_URI)?.trim();
  const required = provider === 'google'
    ? ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET']
    : ['APPLE_CLIENT_ID', 'APPLE_TEAM_ID', 'APPLE_KEY_ID', 'APPLE_PRIVATE_KEY'];
  const missing = required.filter((key) => !process.env[key]?.trim());
  if (missing.length) return `Missing required environment variable(s): ${missing.join(', ')}.`;
  const redirectKey = provider === 'google' ? 'GOOGLE_REDIRECT_URI' : 'APPLE_REDIRECT_URI';
  if (!redirectUri) return `${redirectKey} is missing.`;
  try {
    const base = new URL(backendUrl);
    const redirect = new URL(redirectUri);
    const expectedPath = `/api/auth/oauth/${provider}/callback`;
    if (process.env.NODE_ENV === 'production' && (base.protocol !== 'https:' || redirect.protocol !== 'https:')) {
      return 'BACKEND_URL and the provider redirect URI must use HTTPS in production.';
    }
    if (process.env.NODE_ENV === 'production' && redirect.origin !== base.origin) {
      return `${redirectKey} must use the configured BACKEND_URL origin in production.`;
    }
    if (redirect.pathname !== expectedPath) return `${redirectKey} path must be ${expectedPath}.`;
    if (redirect.username || redirect.password || redirect.search || redirect.hash) {
      return `${redirectKey} must not include credentials, query parameters, or a fragment.`;
    }
  } catch {
    return 'BACKEND_URL or the provider redirect URI is not a valid URL.';
  }
  return null;
}

export function getOAuthConfiguration(provider: OAuthProvider): OAuthConfiguration | null {
  if (getOAuthConfigurationIssue(provider)) return null;
  const backendUrl = process.env.BACKEND_URL!.trim();
  const redirectUri = (provider === 'google'
    ? process.env.GOOGLE_REDIRECT_URI
    : process.env.APPLE_REDIRECT_URI)!.trim();
  const callbackUrl = new URL(redirectUri, backendUrl).toString();
  if (provider === 'google') {
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
    return { clientId: clientId!, clientSecret: clientSecret!, callbackUrl };
  }

  return { clientId: process.env.APPLE_CLIENT_ID!.trim(), callbackUrl };
}

export function getClientRedirect(returnTo: string): URL | null {
  const clientUrl = process.env.CLIENT_URL?.trim();
  if (!clientUrl || returnTo.length > 2048 || !returnTo.startsWith('/') || returnTo.startsWith('//') || /[\\\u0000-\u001f]/.test(returnTo)) {
    return null;
  }
  try {
    const base = new URL(clientUrl);
    if (process.env.NODE_ENV === 'production' && base.protocol !== 'https:') return null;
    const target = new URL(returnTo, base);
    if (target.origin !== base.origin || target.username || target.password) return null;
    return target;
  } catch {
    return null;
  }
}

export function createAppleClientSecret(configuration: OAuthConfiguration): string {
  const teamId = process.env.APPLE_TEAM_ID!.trim();
  const keyId = process.env.APPLE_KEY_ID!.trim();
  const privateKey = process.env.APPLE_PRIVATE_KEY!.replace(/\\n/g, '\n');
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'ES256', kid: keyId, typ: 'JWT' }));
  const payload = base64Url(JSON.stringify({
    iss: teamId,
    iat: now,
    exp: now + 5 * 60,
    aud: 'https://appleid.apple.com',
    sub: configuration.clientId,
  }));
  const signingInput = `${header}.${payload}`;
  const signature = sign('sha256', Buffer.from(signingInput), {
    key: createPrivateKey(privateKey),
    dsaEncoding: 'ieee-p1363',
  });
  return `${signingInput}.${base64Url(signature)}`;
}

export function buildAuthorizationUrl(
  provider: OAuthProvider,
  configuration: OAuthConfiguration,
  state: string,
  nonce: string,
  verifier: string,
): string {
  const definition = providers[provider];
  const url = new URL(definition.authorizationEndpoint);
  url.searchParams.set('client_id', configuration.clientId);
  url.searchParams.set('redirect_uri', configuration.callbackUrl);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', provider === 'google' ? 'openid email profile' : 'name email');
  url.searchParams.set('state', state);
  url.searchParams.set('nonce', nonce);
  if (provider === 'google') {
    url.searchParams.set('code_challenge', base64Url(createHash('sha256').update(verifier).digest()));
    url.searchParams.set('code_challenge_method', 'S256');
    url.searchParams.set('prompt', 'select_account');
  } else {
    url.searchParams.set('response_mode', 'form_post');
  }
  return url.toString();
}

const timedFetch = async (url: string, init?: RequestInit): Promise<Response> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
};

export async function exchangeAuthorizationCode(
  provider: OAuthProvider,
  configuration: OAuthConfiguration,
  code: string,
  verifier: string,
  expectedNonce: string,
): Promise<{ claims: OidcClaims; appleName?: string }> {
  const definition = providers[provider];
  const formValues: Record<string, string> = {
    grant_type: 'authorization_code',
    code,
    redirect_uri: configuration.callbackUrl,
    client_id: configuration.clientId,
  };
  if (provider === 'google') {
    formValues.client_secret = configuration.clientSecret!;
    formValues.code_verifier = verifier;
  } else {
    formValues.client_secret = createAppleClientSecret(configuration);
  }
  const form = new URLSearchParams(formValues);

  const response = await timedFetch(definition.tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });
  if (!response.ok) throw new OAuthServiceError('token_endpoint_rejected', response.status);
  let tokenResponse: { id_token?: string };
  try {
    tokenResponse = await response.json() as { id_token?: string };
  } catch {
    throw new OAuthServiceError('token_response_invalid');
  }
  if (!tokenResponse.id_token || tokenResponse.id_token.length > 16_384) {
    throw new Error('Provider did not return an identity token.');
  }
  const claims = await verifyIdentityToken(provider, configuration.clientId, tokenResponse.id_token);
  const receivedNonce = Buffer.from(claims.nonce || '');
  const wantedNonce = Buffer.from(expectedNonce);
  if (!claims.nonce || receivedNonce.length !== wantedNonce.length ||
      !timingSafeEqual(receivedNonce, wantedNonce)) {
    throw new Error('Identity token nonce was invalid.');
  }
  return { claims };
}

const jwksCache = new Map<OAuthProvider, { expiresAt: number; keys: Array<Record<string, unknown>> }>();

async function getProviderKeys(provider: OAuthProvider, kid: string) {
  let cached = jwksCache.get(provider);
  if (!cached || cached.expiresAt <= Date.now() || !cached.keys.some((key) => key.kid === kid)) {
    const response = await timedFetch(providers[provider].jwksEndpoint);
    if (!response.ok) throw new OAuthServiceError('jwks_endpoint_rejected', response.status);
    let result: { keys?: Array<Record<string, unknown>> };
    try {
      result = await response.json() as { keys?: Array<Record<string, unknown>> };
    } catch {
      throw new OAuthServiceError('provider_keys_invalid');
    }
    if (!Array.isArray(result.keys) || result.keys.length > 20) {
      throw new OAuthServiceError('provider_keys_invalid');
    }
    cached = { expiresAt: Date.now() + 60 * 60_000, keys: result.keys };
    jwksCache.set(provider, cached);
  }
  const key = cached.keys.find((candidate) =>
    candidate.kid === kid && candidate.use === 'sig' &&
    candidate.kty === 'RSA');
  if (!key) throw new Error('Identity token signing key was not recognized.');
  return key;
}

async function verifyIdentityToken(
  provider: OAuthProvider,
  clientId: string,
  token: string,
): Promise<OidcClaims> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Malformed identity token.');
  const decode = (part: string) => Buffer.from(part, 'base64url').toString('utf8');
  let header: { alg?: string; kid?: string };
  let claims: OidcClaims;
  try {
    header = JSON.parse(decode(parts[0]));
    claims = JSON.parse(decode(parts[1]));
  } catch {
    throw new Error('Malformed identity token.');
  }
  const expectedAlgorithm = 'RS256';
  if (header.alg !== expectedAlgorithm || !header.kid || parts[0].length > 2048 || parts[1].length > 8192) {
    throw new Error('Unsupported identity token.');
  }
  const key = await getProviderKeys(provider, header.kid);
  const publicKey = createPublicKey({ key, format: 'jwk' });
  const verified = verify(
    'sha256',
    Buffer.from(`${parts[0]}.${parts[1]}`),
    publicKey,
    Buffer.from(parts[2], 'base64url'),
  );
  const now = Math.floor(Date.now() / 1000);
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  const validIssuer = provider === 'google'
    ? claims.iss === providers.google.issuer || claims.iss === 'accounts.google.com'
    : claims.iss === providers.apple.issuer;
  if (!verified || !validIssuer || !audiences.includes(clientId) ||
      (audiences.length > 1 && claims.azp !== clientId) ||
      (claims.azp !== undefined && claims.azp !== clientId) ||
      typeof claims.exp !== 'number' || claims.exp <= now ||
      typeof claims.iat !== 'number' || claims.iat > now + 60 ||
      typeof claims.sub !== 'string' || !claims.sub || claims.sub.length > 255) {
    throw new Error('Identity token claims were invalid.');
  }
  return claims;
}

export function identityTokenHasVerifiedEmail(claims: OidcClaims) {
  return claims.email_verified === true || claims.email_verified === 'true';
}

export type { OidcClaims };
