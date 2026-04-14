type SupabaseLike = {
  from: (table: string) => {
    select: (cols: string) => any;
    insert: (rows: Record<string, unknown>[]) => any;
  };
};

export async function getSavedIdempotentResponse(
  supabase: SupabaseLike,
  key: string,
): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase
    .from('api_idempotency_keys')
    .select('response_json')
    .eq('idempotency_key', key)
    .maybeSingle();
  if (error || !data) return null;
  const raw = (data as { response_json?: unknown }).response_json;
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
}

export async function saveIdempotentResponse(
  supabase: SupabaseLike,
  key: string,
  endpoint: string,
  responseJson: Record<string, unknown>,
): Promise<void> {
  await supabase.from('api_idempotency_keys').insert([
    {
      idempotency_key: key,
      endpoint,
      response_json: responseJson,
    },
  ]);
}

