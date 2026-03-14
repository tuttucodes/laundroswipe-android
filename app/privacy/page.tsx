import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <div style={{ minHeight: '100vh', padding: 24, maxWidth: 720, margin: '0 auto', fontFamily: 'var(--fb)' }}>
      <h1 style={{ fontFamily: 'var(--fd)', fontSize: 22, marginBottom: 16 }}>Privacy Policy</h1>
      <p style={{ color: 'var(--ts)', lineHeight: 1.7 }}>
        LaundroSwipe respects your privacy. We collect only what is needed to provide laundry pickup and delivery:
        name, contact details, and order information. We do not sell your data.
      </p>
      <p style={{ marginTop: 16 }}>
        <Link href="/" style={{ color: 'var(--b)', fontWeight: 600 }}>← Back to LaundroSwipe</Link>
      </p>
    </div>
  );
}
