import type { Metadata, Viewport } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair' });

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://laundroswipe.com';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'LaundroSwipe — Your Laundry Sorted in One Swipe',
    template: '%s | LaundroSwipe',
  },
  description: 'College laundry pickup & delivery. Schedule pickup from your favorite laundry company in one swipe. Campus pickups, Tue Sat Sun.',
  keywords: ['laundry', 'pickup', 'delivery', 'college', 'campus', 'schedule', 'LaundroSwipe'],
  authors: [{ name: 'LaundroSwipe' }],
  creator: 'LaundroSwipe',
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: siteUrl,
    siteName: 'LaundroSwipe',
    title: 'LaundroSwipe — Your Laundry Sorted in One Swipe',
    description: 'College laundry pickup & delivery. Schedule in one swipe.',
    images: [
      { url: '/icon-512.png', width: 512, height: 512, alt: 'LaundroSwipe' },
    ],
  },
  twitter: {
    card: 'summary',
    title: 'LaundroSwipe — Your Laundry Sorted in One Swipe',
    description: 'College laundry pickup & delivery. Schedule in one swipe.',
    images: ['/icon-512.png'],
  },
  robots: { index: true, follow: true },
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'LaundroSwipe' },
  alternates: { canonical: siteUrl },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#1746A2',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" href="/icon-192.png" sizes="192x192" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="LaundroSwipe" />
      </head>
      <body className={`${inter.variable} ${playfair.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
