import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import { RootClientProviders } from '@/components/layout/RootClientProviders';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-plus-jakarta-sans',
  display: 'swap',
});

export const viewport: Viewport = {
  themeColor: '#294a38',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || 'https://workgrind.app'),
  title: 'WorkGrind | All-in-One Business Workspace',
  description: 'WorkGrind is an all-in-one business workspace combining CRM, team collaboration, tasks, projects, meetings, AI, client portals, and analytics — all in one connected platform.',
  manifest: '/manifest.json',
  icons: {
    icon:    [{ url: '/icon.svg', type: 'image/svg+xml' }],
    shortcut:[{ url: '/icon.svg', type: 'image/svg+xml' }],
    apple:   [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
  },
  openGraph: {
    title:       'WorkGrind | All-in-One Business Workspace',
    description: 'Run your team. Grow your business. CRM, tasks, projects, chat, meetings, AI, client portals, and analytics — all connected in one workspace.',
    url:         'https://workgrind.app',
    siteName:    'WorkGrind',
    images: [
      {
        url:    '/workgrind-icon.svg',
        width:  512,
        height: 512,
        alt:    'WorkGrind logo',
      },
    ],
    type: 'website',
  },
  twitter: {
    card:        'summary',
    title:       'WorkGrind | All-in-One Business Workspace',
    description: 'CRM, team collaboration, tasks, projects, meetings, and AI — one connected workspace.',
    images:      ['/workgrind-icon.svg'],
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
