import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import OfflineIndicator from './components/OfflineIndicator';
import CSSReloader from './components/CSSReloader';
import DesktopHeader from './components/DesktopHeader';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Expenza - Expense Tracker',
  description: 'A beautiful expense tracker for iPhone',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Expenza',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-icon.png',
  },
  other: {
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <CSSReloader />
        <Providers>
          <DesktopHeader />
          <OfflineIndicator />
          {children}
        </Providers>
      </body>
    </html>
  );
}

