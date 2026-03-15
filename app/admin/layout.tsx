import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'Admin',
  description: 'LaundroSwipe admin dashboard — orders, schedule, notifications.',
  manifest: '/admin-manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'LaundroSwipe Admin',
    statusBarStyle: 'default',
  },
};

export const viewport: Viewport = {
  themeColor: '#1746A2',
  width: 'device-width',
  initialScale: 1,
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
