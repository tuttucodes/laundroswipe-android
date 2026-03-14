import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'LaundroSwipe — Your Laundry Sorted in One Swipe',
    short_name: 'LaundroSwipe',
    description: 'College laundry pickup & delivery. Schedule in one swipe.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#1746A2',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  };
}
