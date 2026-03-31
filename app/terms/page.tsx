import Link from 'next/link';
import { SERVICE_FEE_TERMS_EXPLANATION } from '@/lib/fees';
import { CURRENT_TERMS_VERSION } from '@/lib/terms';

export default function TermsPage() {
  return (
    <div className="legal-page">
      <h1>Terms &amp; Conditions</h1>
      <p>
        By using LaundroSwipe you agree to our terms of service. Schedule pickups in good faith, and review the latest terms before placing an order.
      </p>
      <p>
        <strong>Current version:</strong> {CURRENT_TERMS_VERSION}
      </p>
      <p>
        LaundroSwipe is not the laundry vendor. Vendor laundry charges are set separately by the vendor or applicable pricing agreement.
      </p>
      <p>
        {SERVICE_FEE_TERMS_EXPLANATION}
      </p>
      <p>
        Current Service fee slabs: ₹0&ndash;₹49 = ₹0, ₹50&ndash;₹99 = ₹5, ₹100&ndash;₹199 = ₹10, ₹200+ = ₹20.
      </p>
      <p style={{ marginTop: 28 }}>
        <strong>Contact:</strong> support@laundroswipe.com
      </p>
      <p className="legal-back">
        <Link href="/">← Back to LaundroSwipe</Link>
      </p>
    </div>
  );
}
