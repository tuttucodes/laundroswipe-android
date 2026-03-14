import Link from 'next/link';

export default function TermsPage() {
  return (
    <div style={{ minHeight: '100vh', padding: 24, maxWidth: 720, margin: '0 auto', fontFamily: 'var(--fb)' }}>
      <h1 style={{ fontFamily: 'var(--fd)', fontSize: 22, marginBottom: 16 }}>Terms &amp; Conditions</h1>
      <p style={{ color: 'var(--ts)', lineHeight: 1.7 }}>
        By using LaundroSwipe you agree to our terms of service. Schedule pickups in good faith.
        A convenience fee applies per order. Timings are subject to change with notice.
      </p>
      <p style={{ marginTop: 16 }}>
        <Link href="/" style={{ color: 'var(--b)', fontWeight: 600 }}>← Back to LaundroSwipe</Link>
      </p>
    </div>
  );
}
