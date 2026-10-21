import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/siteUrl';

/** Served at /robots.txt (previously 404). Public pages stay crawlable. */
export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/', '/admin-portal/'] }],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
