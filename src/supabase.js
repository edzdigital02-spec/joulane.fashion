import { createClient } from '@supabase/supabase-js';

let supabaseClient = null;
let realtimeChannel = null;

export const SupabaseManager = {
  client: null,

  init(url, key, onSyncCallback) {
    if (!url || !key) {
      supabaseClient = null;
      return null;
    }

    try {
      supabaseClient = createClient(url, key, {
        auth: { persistSession: false }
      });
      this.client = supabaseClient;
      
      // Subscribe to Realtime changes on 'joulane_store' table
      this.subscribeRealtime(onSyncCallback);
      return supabaseClient;
    } catch (e) {
      console.error('Supabase initialization failed:', e);
      return null;
    }
  },

  async fetchAllData() {
    if (!supabaseClient) return null;
    try {
      const { data, error } = await supabaseClient
        .from('joulane_store')
        .select('*');
      
      if (error) {
        console.error('Error fetching Supabase store data:', error);
        return null;
      }

      const result = {};
      (data || []).forEach(row => {
        result[row.id] = row.data;
      });
      return result;
    } catch (e) {
      console.error('Supabase fetch exception:', e);
      return null;
    }
  },

  async pushData(key, dataPayload) {
    if (!supabaseClient) return false;
    try {
      const { error } = await supabaseClient
        .from('joulane_store')
        .upsert({
          id: key,
          data: dataPayload,
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' });

      if (error) {
        console.error(`Supabase upsert error for key ${key}:`, error);
        return false;
      }
      return true;
    } catch (e) {
      console.error(`Supabase push exception for key ${key}:`, e);
      return false;
    }
  },

  subscribeRealtime(onSyncCallback) {
    if (!supabaseClient) return;

    if (realtimeChannel) {
      supabaseClient.removeChannel(realtimeChannel);
    }

    realtimeChannel = supabaseClient
      .channel('joulane_realtime_sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'joulane_store' },
        (payload) => {
          if (payload.new && payload.new.id && payload.new.data) {
            if (onSyncCallback) {
              onSyncCallback(payload.new.id, payload.new.data);
            }
          }
        }
      )
      .subscribe();
  }
};
