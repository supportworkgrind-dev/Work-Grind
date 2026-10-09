type ApiConfiguration = {
  backendOrigin: string;
  baseUrl: string;
};

const getApiConfiguration = (): ApiConfiguration => {
  const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  const configuredApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  const isProduction = process.env.NODE_ENV === 'production';
  if (configuredApiUrl && configuredApiBaseUrl) {
    try {
      if (new URL(configuredApiUrl).origin !== new URL(configuredApiBaseUrl).origin) {
        throw new Error('NEXT_PUBLIC_API_URL and NEXT_PUBLIC_API_BASE_URL must use the same backend origin.');
      }
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('NEXT_PUBLIC_API_')) throw error;
      throw new Error('NEXT_PUBLIC_API_URL and NEXT_PUBLIC_API_BASE_URL must be absolute backend URLs.');
    }
  }
  const configured = configuredApiUrl || configuredApiBaseUrl;
  if (!configured) {
    if (isProduction) {
      throw new Error('Set NEXT_PUBLIC_API_URL to the production backend origin.');
    }
    return { backendOrigin: 'http://localhost:5000', baseUrl: '/api' };
  }

  let apiUrl: URL;
  try {
    apiUrl = new URL(configured);
  } catch {
    throw new Error('The public API URL must be an absolute backend URL.');
  }

  if (apiUrl.username || apiUrl.password || apiUrl.search || apiUrl.hash ||
      (apiUrl.pathname !== '' && apiUrl.pathname !== '/' && apiUrl.pathname !== '/api' && apiUrl.pathname !== '/api/')) {
    throw new Error('The public API URL must be a backend origin, optionally followed by /api.');
  }
  if (isProduction && apiUrl.protocol !== 'https:') {
    throw new Error('The public API URL must use HTTPS in production.');
  }

  const isLocalBackend = /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(apiUrl.hostname);
  if (isProduction && isLocalBackend) {
    throw new Error('The public API URL cannot point to localhost in production.');
  }

  return {
    backendOrigin: apiUrl.origin,
    baseUrl: '/api',
  };
};

export const getApiBaseUrl = (): string => getApiConfiguration().baseUrl;

export function getApiEndpointUrl(path: string, params?: Record<string, string>): string {
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  if (!normalizedPath || normalizedPath.startsWith('/') || /[\\\u0000-\u001f]/.test(normalizedPath)) {
    throw new Error('API endpoint path must be a safe relative path.');
  }

  const { backendOrigin } = getApiConfiguration();
  const endpoint = new URL(`/api/${normalizedPath}`, backendOrigin);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      endpoint.searchParams.set(key, value);
    }
  }
  return endpoint.toString();
}
