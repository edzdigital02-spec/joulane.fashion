import { createClient } from '@supabase/supabase-js';

const PUBLIC_RECORDS = new Set(['config', 'products', 'categories', 'shipping']);

let supabaseClient = null;
let realtimeChannel = null;
let currentUrl = '';
let currentKey = '';
let secureToken = '';
let secureSurface = '';

function restoreSecureSession() {
  try {
    secureToken = sessionStorage.getItem('joulane_secure_token') || '';
    secureSurface = sessionStorage.getItem('joulane_secure_surface') || '';
  } catch (_) {
    secureToken = '';
    secureSurface = '';
  }
}

function saveSecureSession(token, surface) {
  secureToken = token || '';
  secureSurface = surface || '';
  try {
    if (secureToken) {
      sessionStorage.setItem('joulane_secure_token', secureToken);
      sessionStorage.setItem('joulane_secure_surface', secureSurface);
    } else {
      sessionStorage.removeItem('joulane_secure_token');
      sessionStorage.removeItem('joulane_secure_surface');
    }
  } catch (_) {
    // Session storage can be unavailable in isolated tests.
  }
}

restoreSecureSession();

export const SupabaseManager = {
  client: null,

  isConnectedTo(url, key) {
    return !!supabaseClient && currentUrl === url && currentKey === key;
  },

  hasSecureSession(surface) {
    return !!secureToken && (!surface || secureSurface === surface);
  },

  clearSecureSession() {
    saveSecureSession('', '');
  },

  init(url, key, onSyncCallback) {
    if (!url || !key) {
      if (supabaseClient && realtimeChannel) supabaseClient.removeChannel(realtimeChannel);
      supabaseClient = null;
      realtimeChannel = null;
      currentUrl = '';
      currentKey = '';
      this.client = null;
      return null;
    }

    try {
      if (supabaseClient && realtimeChannel) {
        supabaseClient.removeChannel(realtimeChannel);
        realtimeChannel = null;
      }

      supabaseClient = createClient(url, key, { auth: { persistSession: false } });
      currentUrl = url;
      currentKey = key;
      this.client = supabaseClient;
      this.subscribeRealtime(onSyncCallback);
      return supabaseClient;
    } catch (error) {
      console.error('Supabase initialization failed:', error);
      return null;
    }
  },

  async login(userIdentifier, passcode, surface) {
    if (!supabaseClient) return undefined;
    try {
      const { data, error } = await supabaseClient.rpc('joulane_login', {
        p_user_identifier: userIdentifier || 'all',
        p_passcode: passcode,
        p_surface: surface
      });
      if (error) {
        console.error('Secure login failed:', error);
        return undefined;
      }
      if (!data?.token || !data?.user) return null;
      saveSecureSession(data.token, surface);
      return data.user;
    } catch (error) {
      console.error('Secure login exception:', error);
      return undefined;
    }
  },

  async fetchAllData() {
    if (!supabaseClient) return null;
    try {
      const { data: publicRows, error: publicError } = await supabaseClient
        .from('joulane_store')
        .select('*');
      if (publicError) {
        console.error('Error fetching public store data:', publicError);
        return null;
      }

      const result = {};
      (publicRows || []).forEach(row => {
        if (PUBLIC_RECORDS.has(row.id)) result[row.id] = row.data;
      });

      const { data: directory, error: directoryError } = await supabaseClient
        .rpc('joulane_staff_directory');
      if (!directoryError && Array.isArray(directory)) result.users = directory;

      if (secureToken) {
        const { data: secureRows, error: secureError } = await supabaseClient
          .rpc('joulane_secure_data', { p_token: secureToken });
        if (secureError) {
          console.warn('Secure session expired or could not load protected data:', secureError);
          saveSecureSession('', '');
        } else {
          (secureRows || []).forEach(row => {
            result[row.id] = row.data;
          });
        }
      }
      return result;
    } catch (error) {
      console.error('Supabase fetch exception:', error);
      return null;
    }
  },

  async pushData(key, dataPayload) {
    if (!supabaseClient || !secureToken) return false;
    try {
      if (key === 'users') {
        const { data, error } = await supabaseClient.rpc('joulane_staff_save', {
          p_token: secureToken,
          p_users: dataPayload
        });
        if (error) console.error('Secure staff save failed:', error);
        return !error && data === true;
      }

      const { data, error } = await supabaseClient.rpc('joulane_secure_write', {
        p_token: secureToken,
        p_id: key,
        p_data: dataPayload
      });
      if (error) console.error(`Secure write failed for ${key}:`, error);
      return !error && data === true;
    } catch (error) {
      console.error(`Secure write exception for ${key}:`, error);
      return false;
    }
  },

  async submitOrder(order) {
    if (!supabaseClient) return false;
    try {
      const { data, error } = await supabaseClient.rpc('joulane_submit_order', {
        p_order: order
      });
      if (error) console.error('Order submission failed:', error);
      return !error && data === true;
    } catch (error) {
      console.error('Order submission exception:', error);
      return false;
    }
  },

  subscribeRealtime(onSyncCallback) {
    if (!supabaseClient) return;
    if (realtimeChannel) supabaseClient.removeChannel(realtimeChannel);

    realtimeChannel = supabaseClient
      .channel('joulane_realtime_sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'joulane_store' },
        payload => {
          if (payload.new?.id && payload.new?.data && PUBLIC_RECORDS.has(payload.new.id)) {
            onSyncCallback?.(payload.new.id, payload.new.data);
          }
        }
      )
      .subscribe();
  }
};
