import type { MetadataRoute } from 'next';

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
  return publicRoutes.map((route) => ({
    url: new URL(route, baseUrl).toString(),
  }));
}
