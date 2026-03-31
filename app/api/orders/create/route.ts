import { NextResponse } from 'next/server';
import { getAuthenticatedUserContext } from '@/lib/authenticated-user';
import { CURRENT_TERMS_VERSION } from '@/lib/terms';
import { VENDORS } from '@/lib/constants';

type CreateOrderBody = {
  on?: string;
  tk?: string;
  svc?: string;
  sl?: string;
  pd?: string;
  ts?: string;
  status?: string;
  ins?: string;
  vendorName?: string;
};

function resolveVendorSlugFromName(vendorName: string | null | undefined): string | null {
  const normalized = String(vendorName ?? '').trim().toLowerCase();
  if (!normalized) return null;
  const match = VENDORS.find((vendor) => {
    const candidate = vendor.name.toLowerCase();
    return normalized === candidate || normalized.includes(candidate) || candidate.includes(normalized);
  });
  return match?.id ?? null;
}

export async function POST(request: Request) {
  const context = await getAuthenticatedUserContext(request);
  if (!context) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: CreateOrderBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const orderNumber = String(body.on ?? '').trim();
  const token = String(body.tk ?? '').replace(/^#/, '').trim();
  const serviceId = String(body.svc ?? '').trim();
  const serviceName = String(body.sl ?? '').trim();
  const pickupDate = String(body.pd ?? '').trim();
  const timeSlot = String(body.ts ?? '').trim();
  const status = String(body.status ?? 'scheduled').trim() || 'scheduled';
  const instructions = String(body.ins ?? '').trim() || null;
  const vendorName = String(body.vendorName ?? '').trim() || null;

  if (!orderNumber || !token || !serviceId || !serviceName || !pickupDate || !timeSlot) {
    return NextResponse.json({ error: 'Missing required order fields' }, { status: 400 });
  }

  const { supabase, authUserId } = context;
  const { data: userRow, error: userError } = await supabase
    .from('users')
    .select('id, phone, terms_version')
    .eq('auth_id', authUserId)
    .maybeSingle();

  if (userError) return NextResponse.json({ error: userError.message }, { status: 400 });
  if (!userRow?.id) return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
  if (!String(userRow.phone ?? '').trim()) {
    return NextResponse.json({ error: 'Add your phone number before placing an order' }, { status: 400 });
  }
  if (userRow.terms_version !== CURRENT_TERMS_VERSION) {
    return NextResponse.json(
      {
        error: 'Please accept the latest Terms & Conditions before placing an order.',
        code: 'TERMS_NOT_ACCEPTED',
        currentTermsVersion: CURRENT_TERMS_VERSION,
      },
      { status: 403 }
    );
  }

  let vendorId: string | null = null;
  const vendorSlug = resolveVendorSlugFromName(vendorName);
  if (vendorSlug) {
    const { data: vendorRow } = await supabase
      .from('vendors')
      .select('id')
      .eq('slug', vendorSlug)
      .maybeSingle();
    vendorId = vendorRow?.id ?? null;
  }

  const { data, error } = await supabase
    .from('orders')
    .insert({
      order_number: orderNumber,
      token,
      service_id: serviceId,
      service_name: serviceName,
      pickup_date: pickupDate,
      time_slot: timeSlot,
      status,
      instructions,
      user_id: userRow.id,
      vendor_name: vendorName,
      vendor_id: vendorId,
    })
    .select('*')
    .single();

  if (error) {
    const message =
      error.code === '23505'
        ? 'That token or order number was already used. Please try again.'
        : error.message || 'Order failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, order: data });
}
