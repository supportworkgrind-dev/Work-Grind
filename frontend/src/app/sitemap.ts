import type { MetadataRoute } from 'next';
import { HELP_ARTICLES } from '@/lib/helpArticles';

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
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://workgrind.app';
  return [...publicRoutes, ...HELP_ARTICLES.map((article) => `/help/${article.slug}`)].map((route) => ({
    url: new URL(route, baseUrl).toString(),
  }));
}
