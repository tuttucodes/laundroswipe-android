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
      console.error('Supabase client init failed', e);
      sb = null;
    }
  } else {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('LaundroSwipe: Config required. Set environment and run build.');
    }
    sb = null;
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

  async function fetchOrderByToken(token) {
    if (!sb) return null;
    const t = String(token).replace(/^#/, '').trim();
    if (!t) return null;
    try {
      const { data: orders, error } = await sb
        .from('orders')
        .select('*')
        .eq('token', t)
        .order('created_at', { ascending: false })
        .limit(1);
      if (error || !orders || !orders.length) return null;
      const order = orders[0];
      let user = null;
      if (order.user_id) {
        const { data: u } = await sb.from('users').select('*').eq('id', order.user_id).single();
        user = u;
      }
      return { order, user };
    } catch (e) {
      console.error('Supabase fetchOrderByToken exception', e);
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

  async function signInWithGoogle(redirectTo) {
    if (!sb) return { error: { message: 'Sign-in not available' } };
    try {
      var base = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : '';
      if (!base || base === 'null' || base === 'file://') base = 'https://laundroswipe.com';
      var to = redirectTo || (base + (base.endsWith('/') ? '' : '/'));
      const { data, error } = await sb.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: to },
      });
      if (error) return { error };
      if (data && data.url) {
        window.location.href = data.url;
        return { data };
      }
      return { error: { message: 'No redirect URL' } };
    } catch (e) {
      console.error('signInWithGoogle exception', e);
      return { error: { message: e && e.message } };
    }
  }

  async function getAuthSession() {
    if (!sb) return null;
    try {
      const { data: { session }, error } = await sb.auth.getSession();
      if (error || !session) return null;
      return session;
    } catch (e) {
      console.error('getAuthSession exception', e);
      return null;
    }
  }

  async function signOutAuth() {
    if (!sb) return;
    try {
      await sb.auth.signOut();
    } catch (e) {
      console.error('signOutAuth exception', e);
    }
  }

  async function upsertUserFromAuth(authUser) {
    if (!sb || !authUser || !authUser.id) return null;
    const fullName = (authUser.user_metadata && authUser.user_metadata.full_name) ||
      authUser.user_metadata?.name ||
      (authUser.email && authUser.email.split('@')[0]) ||
      'User';
    const row = {
      id: authUser.id,
      full_name: fullName,
      email: authUser.email || '',
      phone: null,
      whatsapp: null,
      user_type: 'general',
      college_id: null,
      reg_no: null,
      hostel_block: null,
      year: null,
    };
    try {
      const { data: upserted, error: upsertErr } = await sb
        .from('users')
        .upsert(row, { onConflict: 'id' })
        .select()
        .single();
      if (!upsertErr && upserted) return upserted;
      const { data: inserted, error: insertErr } = await sb
        .from('users')
        .insert(row)
        .select()
        .single();
      if (!insertErr && inserted) return inserted;
      const { data: existing } = await sb
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single();
      return existing || null;
    } catch (e) {
      console.error('upsertUserFromAuth exception', e);
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
    fetchOrderByToken,
    fetchUsers,
    advanceOrderStatus,
    signInWithGoogle,
    getAuthSession,
    signOutAuth,
    upsertUserFromAuth,
  };
})(window);

