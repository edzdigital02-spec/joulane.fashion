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

      const { data: productOrderStats, error: productOrderStatsError } = await supabaseClient
        .rpc('joulane_public_product_order_stats');
      if (!productOrderStatsError && productOrderStats && typeof productOrderStats === 'object') {
        result.product_order_stats = productOrderStats;
      }

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

  async fetchOrders() {
    if (!supabaseClient || !secureToken || secureSurface !== 'admin') return null;
    try {
      const { data, error } = await supabaseClient
        .rpc('joulane_secure_data', { p_token: secureToken });
      if (error) {
        console.warn('Secure orders refresh failed:', error);
        saveSecureSession('', '');
        return null;
      }
      const ordersRow = (data || []).find(row => row?.id === 'orders');
      if (!ordersRow) return null;
      return Array.isArray(ordersRow.data) ? ordersRow.data : [];
    } catch (error) {
      console.error('Secure orders refresh exception:', error);
      return null;
    }
  },

  async fetchStockProData() {
    if (!supabaseClient || !secureToken || secureSurface !== 'stock') return null;
    try {
      const { data, error } = await supabaseClient
        .rpc('joulane_stock_pro_data', { p_token: secureToken });
      if (error) {
        console.error('Stock Pro data fetch failed:', error);
        return null;
      }
      return (data || []).reduce((result, row) => {
        result[row.id] = row.data;
        return result;
      }, {});
    } catch (error) {
      console.error('Stock Pro data fetch exception:', error);
      return null;
    }
  },

  async saveStockProData(key, payload) {
    if (!supabaseClient || !secureToken || secureSurface !== 'stock') return false;
    try {
      const { data, error } = await supabaseClient.rpc('joulane_stock_pro_save', {
        p_token: secureToken,
        p_id: key,
        p_data: payload
      });
      if (error) console.error(`Stock Pro save failed for ${key}:`, error);
      return !error && data === true;
    } catch (error) {
      console.error(`Stock Pro save exception for ${key}:`, error);
      return false;
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

      if (key === 'stock_notification_settings') {
        const { data, error } = await supabaseClient.rpc('joulane_stock_notification_settings_save', {
          p_token: secureToken,
          p_data: dataPayload
        });
        if (error) console.error('Stock notification settings save failed:', error);
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

  async recordStockMovement(productId, newQuantity, movement) {
    if (!supabaseClient || !secureToken) return false;
    try {
      const { data, error } = await supabaseClient.rpc('joulane_stock_movement_v2', {
        p_token: secureToken,
        p_product_id: productId,
        p_new_qty: newQuantity,
        p_log: movement
      });
      if (error) {
        console.error('Atomic stock movement failed:', error);
        return false;
      }
      return data && typeof data === 'object' ? data : false;
    } catch (error) {
      console.error('Atomic stock movement exception:', error);
      return false;
    }
  },

  async resetAllStock() {
    if (!supabaseClient || !secureToken) return false;
    try {
      const { data, error } = await supabaseClient.rpc('joulane_reset_all_stock', {
        p_token: secureToken
      });
      if (error) {
        console.error('Full stock reset failed:', error);
        return false;
      }
      return data && typeof data === 'object' ? data : false;
    } catch (error) {
      console.error('Full stock reset exception:', error);
      return false;
    }
  },

  async createStockSnapshot(reason = 'manual') {
    if (!supabaseClient || !secureToken) return false;
    try {
      const { data, error } = await supabaseClient.rpc('joulane_stock_snapshot_create', {
        p_token: secureToken,
        p_reason: reason
      });
      if (error) console.error('Stock snapshot creation failed:', error);
      return !error && data ? data : false;
    } catch (error) {
      console.error('Stock snapshot creation exception:', error);
      return false;
    }
  },

  async restoreStockSnapshot(snapshotId) {
    if (!supabaseClient || !secureToken) return false;
    try {
      const { data, error } = await supabaseClient.rpc('joulane_stock_snapshot_restore', {
        p_token: secureToken,
        p_snapshot_id: snapshotId
      });
      if (error) console.error('Stock snapshot restore failed:', error);
      return !error && data ? data : false;
    } catch (error) {
      console.error('Stock snapshot restore exception:', error);
      return false;
    }
  },

  async reviewStockApproval(approvalId, decision) {
    if (!supabaseClient || !secureToken) return false;
    try {
      const { data, error } = await supabaseClient.rpc('joulane_stock_approval_review', {
        p_token: secureToken,
        p_approval_id: approvalId,
        p_decision: decision
      });
      if (error) console.error('Stock approval review failed:', error);
      return !error && data ? data : false;
    } catch (error) {
      console.error('Stock approval review exception:', error);
      return false;
    }
  },

  async transferStockLocation(productId, fromLocation, toLocation, quantity) {
    if (!supabaseClient || !secureToken) return false;
    try {
      const { data, error } = await supabaseClient.rpc('joulane_stock_location_transfer', {
        p_token: secureToken,
        p_product_id: productId,
        p_from_location: fromLocation,
        p_to_location: toLocation,
        p_quantity: quantity
      });
      if (error) console.error('Stock location transfer failed:', error);
      return !error && data ? data : false;
    } catch (error) {
      console.error('Stock location transfer exception:', error);
      return false;
    }
  },

  async commitStockAudit(audit) {
    if (!supabaseClient || !secureToken) return false;
    try {
      const { data, error } = await supabaseClient.rpc('joulane_stock_audit_commit', {
        p_token: secureToken,
        p_audit: audit
      });
      if (error) console.error('Stock audit commit failed:', error);
      return !error && data ? data : false;
    } catch (error) {
      console.error('Stock audit commit exception:', error);
      return false;
    }
  },

  async undoStockMovement(logId) {
    if (!supabaseClient || !secureToken) return false;
    try {
      const { data, error } = await supabaseClient.rpc('joulane_stock_undo', {
        p_token: secureToken,
        p_log_id: logId
      });
      if (error) console.error('Stock movement undo failed:', error);
      return !error && data ? data : false;
    } catch (error) {
      console.error('Stock movement undo exception:', error);
      return false;
    }
  },

  async markStockReceiptDelivery(delivery) {
    if (!supabaseClient || !secureToken) return false;
    try {
      const { data, error } = await supabaseClient.rpc('joulane_receipt_delivery_mark', {
        p_token: secureToken,
        p_delivery: delivery
      });
      if (error) console.error('Stock receipt delivery mark failed:', error);
      return !error && data === true;
    } catch (error) {
      console.error('Stock receipt delivery mark exception:', error);
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

  async trackOrder(trackingCode) {
    if (!supabaseClient) return { status: 'unavailable' };
    try {
      const { data, error } = await supabaseClient.rpc('joulane_track_order', {
        p_tracking_code: trackingCode
      });
      if (error) {
        console.error('Order tracking failed:', error);
        return { status: 'unavailable' };
      }
      return data && typeof data === 'object' ? data : { status: 'not_found' };
    } catch (error) {
      console.error('Order tracking exception:', error);
      return { status: 'unavailable' };
    }
  },

  async updateOrder(orderId, updates, expectedUpdatedAt = null) {
    if (!supabaseClient || !secureToken || secureSurface !== 'admin') return false;
    try {
      const { data, error } = await supabaseClient.rpc('joulane_order_update', {
        p_token: secureToken,
        p_order_id: orderId,
        p_updates: updates,
        p_expected_updated_at: expectedUpdatedAt || null
      });
      if (error) {
        console.error('Atomic order update failed:', error);
        return false;
      }
      return data && typeof data === 'object' ? data : false;
    } catch (error) {
      console.error('Atomic order update exception:', error);
      return false;
    }
  },

  async deleteOrder(orderId, expectedUpdatedAt = null) {
    if (!supabaseClient || !secureToken || secureSurface !== 'admin') return false;
    try {
      const { data, error } = await supabaseClient.rpc('joulane_order_delete', {
        p_token: secureToken,
        p_order_id: orderId,
        p_expected_updated_at: expectedUpdatedAt || null
      });
      if (error) {
        console.error('Atomic order deletion failed:', error);
        return false;
      }
      return data && typeof data === 'object' ? data : false;
    } catch (error) {
      console.error('Atomic order deletion exception:', error);
      return false;
    }
  },

  async clearOrders(orderIds) {
    if (!supabaseClient || !secureToken || secureSurface !== 'admin') return false;
    try {
      const { data, error } = await supabaseClient.rpc('joulane_orders_clear', {
        p_token: secureToken,
        p_order_ids: Array.isArray(orderIds) ? orderIds : []
      });
      if (error) {
        console.error('Atomic order clearing failed:', error);
        return false;
      }
      return data && typeof data === 'object' ? data : false;
    } catch (error) {
      console.error('Atomic order clearing exception:', error);
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
