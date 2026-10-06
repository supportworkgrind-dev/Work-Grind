export const getApiBaseUrl = (): string => {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
  const isProduction = process.env.NODE_ENV === 'production';
  if (!configured) {
    if (isProduction) {
      throw new Error('NEXT_PUBLIC_API_URL must be configured for production deployments.');
    }
    return '/api';
  }

  let apiUrl: URL;
  try {
    apiUrl = new URL(configured);
  } catch {
    throw new Error('NEXT_PUBLIC_API_URL must be an absolute backend URL.');
  }

  if (apiUrl.username || apiUrl.password || apiUrl.search || apiUrl.hash ||
      (apiUrl.pathname !== '' && apiUrl.pathname !== '/' && apiUrl.pathname !== '/api' && apiUrl.pathname !== '/api/')) {
    throw new Error('NEXT_PUBLIC_API_URL must be a backend origin, optionally followed by /api.');
  }
  if (isProduction && apiUrl.protocol !== 'https:') {
    throw new Error('NEXT_PUBLIC_API_URL must use HTTPS in production.');
  }

  const isLocalBackend = /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(apiUrl.hostname);
  if (isProduction && isLocalBackend) {
    throw new Error('NEXT_PUBLIC_API_URL cannot point to localhost in production.');
  }
  if (isLocalBackend) return '/api';

  return `${apiUrl.origin}/api`;
};
