;(function (global) {
  const cfg = (global.__LS_CONFIG__) || {};
  const SUPA_URL = cfg.SUPA_URL;
  const SUPA_KEY = cfg.SUPA_KEY;

  let sb = null;
  if (global.supabase && SUPA_URL && SUPA_KEY &&
      SUPA_URL !== 'YOUR_SUPABASE_URL_HERE' &&
      SUPA_KEY !== 'YOUR_SUPABASE_ANON_KEY_HERE') {
    try {
      sb = global.supabase.createClient(SUPA_URL, SUPA_KEY);
    } catch (e) {
      console.warn('Failed to init Supabase client, falling back to local-only mode', e);
      sb = null;
    }
  } else {
    console.warn('Supabase config missing or placeholder, running in local-only demo mode');
  }

  async function createUser(user) {
    if (!sb) return null;
    try {
      const { data, error } = await sb
        .from('users')
        .insert({
          full_name: user.fn,
          email: user.em,
          phone: user.ph,
          whatsapp: user.wa,
          user_type: user.ut,
          college_id: user.cid || null,
          reg_no: user.rn || null,
          hostel_block: user.hos || null,
          year: user.yr || null,
        })
        .select()
        .single();
      if (error) {
        console.error('Supabase createUser error', error);
        return null;
      }
      return data;
    } catch (e) {
      console.error('Supabase createUser exception', e);
      return null;
    }
  }

  async function createOrder(order, userId) {
    if (!sb) return null;
    try {
      const { data, error } = await sb
        .from('orders')
        .insert({
          order_number: order.on,
          token: order.tk,
          service_id: order.svc,
          service_name: order.sl,
          pickup_date: order.pd,
          time_slot: order.ts,
          status: order.status,
          instructions: order.ins || null,
          user_id: userId || null,
        })
        .select()
        .single();
      if (error) {
        console.error('Supabase createOrder error', error);
        return null;
      }
      return data;
    } catch (e) {
      console.error('Supabase createOrder exception', e);
      return null;
    }
  }

  async function fetchOrders() {
    if (!sb) return null;
    try {
      const { data, error } = await sb
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) {
        console.error('Supabase fetchOrders error', error);
        return null;
      }
      return data;
    } catch (e) {
      console.error('Supabase fetchOrders exception', e);
      return null;
    }
  }

  async function fetchOrdersForUser(userId) {
    if (!sb) return null;
    try {
      const { data, error } = await sb
        .from('orders')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) {
        console.error('Supabase fetchOrdersForUser error', error);
        return null;
      }
      return data;
    } catch (e) {
      console.error('Supabase fetchOrdersForUser exception', e);
      return null;
    }
  }

  async function fetchUsers() {
    if (!sb) return null;
    try {
      const { data, error } = await sb
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) {
        console.error('Supabase fetchUsers error', error);
        return null;
      }
      return data;
    } catch (e) {
      console.error('Supabase fetchUsers exception', e);
      return null;
    }
  }

  async function advanceOrderStatus(orderId) {
    if (!sb) return null;
    try {
      const { data: existing, error: getErr } = await sb
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();
      if (getErr || !existing) {
        console.error('Supabase advanceOrderStatus load error', getErr);
        return null;
      }
      const STATUSES = [
        'scheduled',
        'agent_assigned',
        'picked_up',
        'processing',
        'ready',
        'out_for_delivery',
        'delivered',
      ];
      const currentIdx = STATUSES.indexOf(existing.status);
      if (currentIdx < 0 || currentIdx >= STATUSES.length - 1) {
        return existing;
      }
      const nextStatus = STATUSES[currentIdx + 1];
      const { data, error } = await sb
        .from('orders')
        .update({ status: nextStatus })
        .eq('id', orderId)
        .select()
        .single();
      if (error) {
        console.error('Supabase advanceOrderStatus update error', error);
        return null;
      }
      return data;
    } catch (e) {
      console.error('Supabase advanceOrderStatus exception', e);
      return null;
    }
  }

  global.LSApi = {
    hasSupabase: !!sb,
    createUser,
    createOrder,
    fetchOrders,
    fetchOrdersForUser,
    fetchUsers,
    advanceOrderStatus,
  };
})(window);

