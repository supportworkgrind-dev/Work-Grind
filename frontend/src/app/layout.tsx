import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import { RootClientProviders } from '@/components/layout/RootClientProviders';
import { getSiteUrl } from '@/lib/siteUrl';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-plus-jakarta-sans',
  display: 'swap',
});

export const viewport: Viewport = {
  themeColor: '#315f59',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: 'WorkGrind | Connected Workspaces for Work and Learning',
  description: 'WorkGrind is a connected workspace for individuals and freelancers, business and office teams, and schools, colleges, and universities. Features vary by workspace, role, and plan.',
  manifest: '/manifest.json',
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon:    [{ url: '/icon.svg', type: 'image/svg+xml' }],
    shortcut:[{ url: '/icon.svg', type: 'image/svg+xml' }],
    apple:   [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
  },
  openGraph: {
    title:       'WorkGrind | Connected Workspaces for Work and Learning',
    description: 'Bring personal work, team collaboration, business tools, and education administration together. Tavro AI supports work and learning where available.',
    url:         '/',
    siteName:    'WorkGrind',
    images: [
      {
        url:    '/workgrind-og.png',
        width:  1200,
        height: 630,
        alt:    'WorkGrind — Connected Workspaces for Work and Learning',
      },
    ],
    type: 'website',
  },
  twitter: {
    card:        'summary_large_image',
    title:        'WorkGrind | Connected Workspaces for Work and Learning',
    description: 'A connected workspace for individuals, businesses, offices, schools, colleges, and universities—with Tavro AI for work and learning.',
    images:      ['/workgrind-og.png'],
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Nonce-based CSP requires rendering with the request-specific proxy headers.
  const requestHeaders = await headers();
  const themeCookie = requestHeaders.get('cookie')
    ?.split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith('workgrind_theme='))
    ?.slice('workgrind_theme='.length);
  const savedTheme = themeCookie ?? '';
  const themeAliases: Record<string, string> = {
    light: 'original',
    dark: 'midnight',
    aurora: 'forest',
    graphite: 'midnight',
    neutral: 'sand',
    developer: 'midnight',
    creative: 'original',
    marketing: 'original',
    sales: 'slate',
    project_manager: 'slate',
    freelancer: 'original',
    executive: 'midnight',
    student: 'original',
    professional: 'original',
  };
  const allowedThemes = ['original', 'midnight', 'slate', 'forest', 'ocean', 'sand', 'plum', 'high-contrast'];
  const initialTheme = themeAliases[savedTheme] ?? (allowedThemes.includes(savedTheme) ? savedTheme : 'original');
  return (
    <html lang="en" className={plusJakartaSans.variable} data-theme={initialTheme}>
      <body className="min-h-screen antialiased">
        <RootClientProviders>{children}</RootClientProviders>
      </body>
    </html>
  );
}
