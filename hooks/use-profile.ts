import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { LSApi, type UserRow } from '@/lib/api';
import { useAuth } from '@/store/auth';

/**
 * Bootstraps the signed-in user's profile row and keeps the Zustand auth store in sync.
 * First call after login upserts the users row (OAuth path) via LSApi. Subsequent mounts
 * reuse the TanStack cache and only refetch on window focus / stale after 60s.
 */

async function ensureProfileForAuthUser(authUserId: string): Promise<UserRow | null> {
  const existing = await LSApi.fetchUserById(authUserId);
  if (existing) return existing;

  // Fall back to auth_id lookup (legacy web users where users.id != auth.uid()).
  const { data: legacy } = await supabase
    .from('users')
    .select(
      'id, full_name, email, phone, whatsapp, user_type, college_id, reg_no, hostel_block, room_number, year, display_id, terms_accepted_at, terms_version',
    )
    .eq('auth_id', authUserId)
    .maybeSingle();
  if (legacy) return legacy as UserRow;
  return null;
}

export function useProfile() {
  const session = useAuth((s) => s.session);
  const setProfile = useAuth((s) => s.setProfile);

  const query = useQuery({
    queryKey: ['profile', session?.user.id ?? null],
    enabled: !!session?.user.id,
    staleTime: 60_000,
    queryFn: async () => {
      if (!session?.user.id) return null;
      return ensureProfileForAuthUser(session.user.id);
    },
  });

  useEffect(() => {
    if (query.data !== undefined) setProfile(query.data ?? null);
  }, [query.data, setProfile]);

  return query;
}
