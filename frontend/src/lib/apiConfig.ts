export const getApiBaseUrl = (): string => {
  const configured = process.env.NEXT_PUBLIC_API_URL;
  if (configured) {
    const isLocalBackend = configured.includes('localhost:5000') || configured.includes('127.0.0.1:5000');
    return isLocalBackend ? '/api' : configured;
  }
  return '/api';
};
