type SupabaseLike = {
  rpc: (name: string, args: Record<string, unknown>) => Promise<{ error?: { message?: string } | null }>;
};

export async function logApiUsageDaily(
  supabase: SupabaseLike,
  endpoint: string,
  approxResponseBytes: number,
): Promise<void> {
  try {
    await supabase.rpc('record_api_usage_daily', {
      p_endpoint: endpoint,
      p_calls: 1,
      p_response_bytes: Math.max(0, Math.floor(approxResponseBytes || 0)),
    });
  } catch {
    // best-effort observability only
  }
}

