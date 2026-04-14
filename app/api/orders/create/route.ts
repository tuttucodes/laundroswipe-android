import { NextResponse } from 'next/server';
import { getAuthenticatedUserContext } from '@/lib/authenticated-user';
import { CURRENT_TERMS_VERSION } from '@/lib/terms';
import { VENDORS } from '@/lib/constants';
import { normalizeScheduleDateRowsFromDb, type RawDbScheduleDateRow } from '@/lib/schedule-normalize';
import { assertBookingMatchesSchedule } from '@/lib/schedule-booking-guard';
import type { ScheduleSlotRow } from '@/lib/api';

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
  /** Vendor slug (e.g. profab); preferred for campus validation */
  vendorSlug?: string;
  /** App college id (e.g. vit-chn); required when profile college is general / unset */
  campusId?: string;
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
  const bodyVendorSlug = String(body.vendorSlug ?? '').trim().toLowerCase();

  if (!orderNumber || !token || !serviceId || !serviceName || !pickupDate || !timeSlot) {
    return NextResponse.json({ error: 'Missing required order fields' }, { status: 400 });
  }

  const { supabase, authUserId } = context;
  const { data: userRow, error: userError } = await supabase
    .from('users')
    .select('id, phone, terms_version, college_id, user_type, reg_no, hostel_block, room_number')
    .eq('auth_id', authUserId)
    .maybeSingle();

  if (userError) return NextResponse.json({ error: userError.message }, { status: 400 });
  if (!userRow?.id) return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
  if (!String(userRow.phone ?? '').trim()) {
    return NextResponse.json({ error: 'Add your phone number before placing an order' }, { status: 400 });
  }

  const ut = String((userRow as { user_type?: string | null }).user_type ?? '').toLowerCase();
  const cidRaw = String((userRow as { college_id?: string | null }).college_id ?? '').trim().toLowerCase();
  const isCampusStudent = ut === 'student' || (Boolean(cidRaw) && cidRaw !== 'general');
  if (isCampusStudent) {
    const reg = String((userRow as { reg_no?: string | null }).reg_no ?? '').trim();
    const block = String((userRow as { hostel_block?: string | null }).hostel_block ?? '').trim();
    const room = String((userRow as { room_number?: string | null }).room_number ?? '').trim();
    if (!reg || !block || !room) {
      return NextResponse.json(
        {
          error: 'Add your registration number, hostel block, and room number in your profile to book campus pickup.',
          code: 'STUDENT_DETAILS_REQUIRED',
        },
        { status: 400 },
      );
    }
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

  const profileCampus = String(userRow.college_id ?? '').trim().toLowerCase();
  const bodyCampus = String(body.campusId ?? '').trim().toLowerCase();
  let campusForBooking: string | null =
    profileCampus && profileCampus !== 'general' ? profileCampus : bodyCampus || null;
  if (!campusForBooking) {
    return NextResponse.json(
      {
        error: 'Select your college in your profile (or your campus in the app) before booking.',
        code: 'CAMPUS_REQUIRED',
      },
      { status: 400 },
    );
  }

  let vendorId: string | null = null;
  const vendorSlug = (bodyVendorSlug && /^[a-z0-9-]{2,40}$/.test(bodyVendorSlug) ? bodyVendorSlug : null) ?? resolveVendorSlugFromName(vendorName);
  if (vendorSlug) {
    const { data: vendorRow } = await supabase
      .from('vendors')
      .select('id')
      .eq('slug', vendorSlug)
      .maybeSingle();
    vendorId = vendorRow?.id ?? null;
  }

  if (!vendorId || !vendorSlug) {
    return NextResponse.json({ error: 'Unknown laundry partner. Please pick a vendor from the list.' }, { status: 400 });
  }

  const { data: campusLink, error: campusErr } = await supabase
    .from('vendor_campus')
    .select('vendor_id')
    .eq('vendor_id', vendorId)
    .eq('campus_id', campusForBooking)
    .maybeSingle();

  let skipCampusCheck = false;
  if (campusErr) {
    const msg = String(campusErr.message ?? '').toLowerCase();
    if (msg.includes('vendor_campus') || msg.includes('does not exist') || msg.includes('schema cache')) {
      skipCampusCheck = true;
    } else {
      return NextResponse.json({ error: campusErr.message }, { status: 400 });
    }
  }

  if (!skipCampusCheck && !campusLink) {
    const { count, error: cntErr } = await supabase.from('vendor_campus').select('*', { count: 'exact', head: true });
    if (!cntErr && (count ?? 0) > 0) {
      return NextResponse.json(
        {
          error: 'This laundry partner is not available at your campus.',
          code: 'VENDOR_CAMPUS_MISMATCH',
        },
        { status: 403 },
      );
    }
  }

  const [slotsRes, datesRes] = await Promise.all([
    supabase
      .from('schedule_slots')
      .select('id, label, time_from, time_to, sort_order, active, created_at')
      .order('sort_order', { ascending: true }),
    supabase
      .from('schedule_dates')
      .select('date, enabled, slot_ids, enabled_by_vendor, created_at, updated_at')
      .order('date', { ascending: true }),
  ]);
  if (slotsRes.error || datesRes.error) {
    const msg = slotsRes.error?.message || datesRes.error?.message || 'Schedule lookup failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
  const scheduleSlots = (slotsRes.data ?? []) as ScheduleSlotRow[];
  const scheduleDates = normalizeScheduleDateRowsFromDb((datesRes.data ?? []) as RawDbScheduleDateRow[]);
  const bookingGuard = assertBookingMatchesSchedule({
    dates: scheduleDates,
    slots: scheduleSlots,
    vendorSlug,
    pickupDate,
    timeSlotId: timeSlot,
  });
  if (!bookingGuard.ok) {
    return NextResponse.json(
      { error: bookingGuard.error, code: bookingGuard.code },
      { status: bookingGuard.code === 'PICKUP_DATE_PAST' ? 400 : 409 },
    );
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
    .select('id, order_number, token, service_id, service_name, pickup_date, time_slot, status, instructions, user_id, vendor_name, vendor_id, created_at')
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
