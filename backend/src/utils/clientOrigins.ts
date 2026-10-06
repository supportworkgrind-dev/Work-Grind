export function getAllowedClientOrigins(): string[] {
  const configuredOrigins = `${process.env.CLIENT_URL || ''},${process.env.CORS_ORIGINS || ''}`
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const localDevelopmentOrigins = process.env.NODE_ENV === 'production'
    ? []
    : [3000, 3001, 3002].flatMap((port) => [
        `http://localhost:${port}`,
        `http://127.0.0.1:${port}`,
      ]);

  return Array.from(new Set([...configuredOrigins, ...localDevelopmentOrigins]));
}
