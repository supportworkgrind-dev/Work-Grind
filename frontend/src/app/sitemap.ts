import type { MetadataRoute } from 'next';
import { HELP_ARTICLES } from '@/lib/helpArticles';
import { getSiteUrl } from '@/lib/siteUrl';

const publicRoutes = [
  '',
  '/about',
  '/features',
  '/how-it-works',
  '/demo',
  '/contact',
  '/pricing',
  '/help',
  '/support',
  '/security',
  '/accessibility',
  '/privacy',
  '/terms',
  '/cookies',
  '/acceptable-use',
  '/community-guidelines',
  '/disclaimer',
  '/dpa',
  '/refunds',
  '/cancellation',
  '/responsible-disclosure',
];

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getSiteUrl();
  return [...publicRoutes, ...HELP_ARTICLES.map((article) => `/help/${article.slug}`)].map((route) => ({
    url: new URL(route, baseUrl).toString(),
  }));
}
