import type { Metadata, Viewport } from 'next';
import './globals.css';

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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700;9..144,800&display=swap"
          rel="stylesheet"
        />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="LaundroSwipe" />
      </head>
      <body>{children}</body>
    </html>
  );
}
