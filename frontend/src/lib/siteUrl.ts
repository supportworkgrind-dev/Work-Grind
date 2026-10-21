/**
 * Public origin used for metadata, canonical URLs, the sitemap, and robots.txt.
 *
 * Order: an explicit NEXT_PUBLIC_BASE_URL, then Vercel's system-provided
 * production domain, then the current production deployment. The previous
 * hardcoded fallback (workgrind.app) does not resolve, which pointed every
 * sitemap and Open Graph URL at a non-existent host.
 */
export function getSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');
  const vercelProduction = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercelProduction) return `https://${vercelProduction.replace(/\/+$/, '')}`;
  return 'https://workgrind.vercel.app';
}
