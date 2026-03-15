import Link from 'next/link';

export default function TermsPage() {
  return (
    <div className="legal-page">
      <h1>Terms &amp; Conditions</h1>
      <p>
        By using LaundroSwipe you agree to our terms of service. Schedule pickups in good faith.
        A convenience fee applies per order. Timings are subject to change with notice.
      </p>
      <p style={{ marginTop: 24 }}>
        <strong>Contact:</strong> support@laundroswipe.com
      </p>
      <p style={{ marginTop: 24 }}>
        <Link href="/">← Back to LaundroSwipe</Link>
      </p>
    </div>
  );
}
