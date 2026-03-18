'use client';

import { useEffect } from 'react';

export function OAuthRedirectToDashboard() {
  useEffect(() => {
    const { hash, search } = window.location;
    const hasOAuthHash = !!hash && /(access_token|refresh_token|type=recovery)/.test(hash);
    const hasOAuthCode = !!search && /(^|[?&])code=/.test(search);
    const hasOAuthError = !!search && /(^|[?&])error=/.test(search);

    if (!hasOAuthHash && !hasOAuthCode && !hasOAuthError) return;

    // Supabase OAuth sometimes lands on "/" depending on provider/site URL settings.
    // Move the callback to the app shell so the session can be applied and user can book.
    window.location.replace(`/dashboard${search || ''}${hash || ''}`);
  }, []);

  return null;
}

