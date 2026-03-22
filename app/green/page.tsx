import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Green',
  robots: { index: false, follow: false },
};

/** Solid #06402B full-screen page at /green */
export default function GreenPage() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: '#06402B',
      }}
    />
  );
}
