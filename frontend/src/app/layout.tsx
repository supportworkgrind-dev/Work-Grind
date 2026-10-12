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
  themeColor: '#315f59',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || 'https://workgrind.app'),
  title: 'WorkGrind | Connected Workspaces for Work and Learning',
  description: 'WorkGrind offers separate workspaces for personal productivity, businesses, schools, colleges, and universities, with capabilities suited to each.',
  manifest: '/manifest.json',
  icons: {
    icon:    [{ url: '/icon.svg', type: 'image/svg+xml' }],
    shortcut:[{ url: '/icon.svg', type: 'image/svg+xml' }],
    apple:   [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
  },
  openGraph: {
    title:       'WorkGrind | Connected Workspaces for Work and Learning',
    description: 'Choose a workspace for personal productivity, business collaboration, or academic administration.',
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
    title:        'WorkGrind | Connected Workspaces for Work and Learning',
    description: 'Personal productivity, business collaboration, and academic administration in purpose-specific workspaces.',
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
