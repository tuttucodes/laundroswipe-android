import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export type VendorProfileRow = {
  id: string;
  slug: string;
  name: string;
  brief: string | null;
  pricing_details: string | null;
  updated_at?: string;
};

export async function GET(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  if (!url || !anonKey) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug') ?? 'profab';
  const supabase = createClient(url, anonKey);
  const { data, error } = await supabase
    .from('vendor_profiles')
    .select('id, slug, name, brief, pricing_details, updated_at')
    .eq('slug', slug)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ? (data as VendorProfileRow) : null);
}
