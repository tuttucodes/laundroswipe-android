import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <div className="legal-page">
      <h1>Privacy Policy</h1>
      <p>
        LaundroSwipe respects your privacy. We collect only what is needed to provide laundry pickup and delivery:
        name, contact details, and order information. We do not sell your data.
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
