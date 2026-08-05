import { PRODUCTS } from './data/products.js';
import { WILAYAS } from './data/wilayas.js';
import { DEFAULT_CONFIG } from './data/defaultConfig.js';
import { SupabaseManager } from './supabase.js';

export const DEFAULT_CATEGORIES = [
  { id: 'wedding', nameAr: 'أحذية أعراس', nameFr: 'Chaussures Mariage' },
  { id: 'heels', nameAr: 'كعب عالي', nameFr: 'Talons Hauts' },
  { id: 'evening', nameAr: 'سهرة', nameFr: 'Soirée' },
  { id: 'sandals', nameAr: 'صندل', nameFr: 'Sandales' },
  { id: 'claquette', nameAr: 'كلاكات', nameFr: 'Claquettes' },
  { id: 'sabot', nameAr: 'صابو', nameFr: 'Sabots' },
  { id: 'shoes', nameAr: 'حذاء', nameFr: 'Chaussures' }
];

const STORAGE_KEYS = {
  PRODUCTS: 'joulane_products',
  PRODUCTS_VERSION: 'joulane_products_version',
  CONFIG: 'joulane_site_config',
  ORDERS: 'joulane_orders',
  SHIPPING: 'joulane_shipping_rates',
  PASSCODE: 'joulane_admin_pass',
  CART: 'joulane_cart',
  CATEGORIES: 'joulane_categories',
  STOCK_LOGS: 'joulane_stock_logs',
  STOCK_NOTIFICATION_SETTINGS: 'joulane_stock_notification_settings',
  STOCK_RECEIPT_DELIVERIES: 'joulane_stock_receipt_deliveries',
  STOCK_LOCATIONS: 'joulane_stock_locations',
  STOCK_PRO_SETTINGS: 'joulane_stock_pro_settings',
  STOCK_SNAPSHOTS: 'joulane_stock_snapshots',
  STOCK_AUDITS: 'joulane_stock_audits',
  STOCK_APPROVALS: 'joulane_stock_approvals',
  PRODUCT_ORDER_STATS: 'joulane_product_order_stats',
  STOCK_OFFLINE_QUEUE: 'joulane_stock_offline_queue',
  OFFLINE_CREDENTIALS: 'joulane_offline_credentials',
  USERS: 'joulane_users',
  PENDING_SYNC: 'joulane_pending_sync'
};

const PRODUCT_CATALOG_VERSION = '2026-08-05-shoe-sizes-36-41-v6';
const PAIRS_PER_CARTON = 18;
const DEFAULT_UNIT_PRICE = 3200;
const SHOE_SIZES = Object.freeze([36, 37, 38, 39, 40, 41]);

function normalizeShoeSizeFeature(feature) {
  return String(feature).replace(/35([^0-9]*?)44/g, (_, separator) => `36${separator}41`);
}

function normalizedPairsPerSeries(product) {
  const requestedPairs = Number(product?.pairsPerSeries);
  const validPairs = Number.isFinite(requestedPairs) && requestedPairs >= 1
    ? Math.floor(requestedPairs)
    : 0;

  // The old cloud catalog used 15 for every product. Keep newly configured
  // values (including 15) while migrating unconfigured legacy rows to 18.
  if (product?.pairsPerSeriesConfigured === true && validPairs) return validPairs;
  if (validPairs && validPairs !== 15) return validPairs;
  return PAIRS_PER_CARTON;
}

function normalizedCartonFeatures(features, pairs) {
  const normalizeLanguage = (items, language) => {
    const cartonPattern = language === 'fr'
      ? /carton\s+de\s+\d+\s+paires?/i
      : /\d+\s*زوج(?:اً|ًا)?\s*في\s*الكرتون/i;
    const cartonText = language === 'fr' ? `Carton de ${pairs} paires` : `${pairs} زوجاً في الكرتون`;
    const source = Array.isArray(items) ? items.map(normalizeShoeSizeFeature) : [];
    const existingIndex = source.findIndex(item => cartonPattern.test(item));
    if (existingIndex >= 0) source[existingIndex] = cartonText;
    else source.unshift(cartonText);
    return source;
  };

  return {
    ar: normalizeLanguage(features?.ar, 'ar'),
    fr: normalizeLanguage(features?.fr, 'fr')
  };
}

function normalizeCatalogProduct(product) {
  const pairsPerSeries = normalizedPairsPerSeries(product);
  const unitPrice = Number(product?.price) > 0 ? Number(product.price) : DEFAULT_UNIT_PRICE;
  const cartonPrice = Number(product?.seriesPrice) > 0
    ? Number(product.seriesPrice)
    : unitPrice * pairsPerSeries;

  return {
    ...product,
    price: unitPrice,
    seriesPrice: cartonPrice,
    pairsPerSeries,
    sizes: [...SHOE_SIZES],
    features: normalizedCartonFeatures(product?.features, pairsPerSeries),
    isAvailable: product?.isAvailable !== false
  };
}

const VALID_ORDER_STATUSES = new Set([
  'New',
  'Confirmed',
  'Shipped',
  'Delivered',
  'Cancelled'
]);

const CLOUD_RECORDS = {
  config: { storageKey: STORAGE_KEYS.CONFIG, eventName: 'joulane:configUpdated' },
  products: { storageKey: STORAGE_KEYS.PRODUCTS, eventName: 'joulane:productsUpdated' },
  categories: { storageKey: STORAGE_KEYS.CATEGORIES, eventName: 'joulane:categoriesUpdated' },
  orders: { storageKey: STORAGE_KEYS.ORDERS, eventName: 'joulane:ordersUpdated' },
  shipping: { storageKey: STORAGE_KEYS.SHIPPING, eventName: 'joulane:shippingUpdated' },
  stock_logs: { storageKey: STORAGE_KEYS.STOCK_LOGS, eventName: 'joulane:stockLogsUpdated' },
  stock_notification_settings: { storageKey: STORAGE_KEYS.STOCK_NOTIFICATION_SETTINGS, eventName: 'joulane:stockNotificationSettingsUpdated' },
  stock_receipt_deliveries: { storageKey: STORAGE_KEYS.STOCK_RECEIPT_DELIVERIES, eventName: 'joulane:stockReceiptDeliveriesUpdated' },
  stock_locations: { storageKey: STORAGE_KEYS.STOCK_LOCATIONS, eventName: 'joulane:stockLocationsUpdated' },
  stock_pro_settings: { storageKey: STORAGE_KEYS.STOCK_PRO_SETTINGS, eventName: 'joulane:stockProSettingsUpdated' },
  stock_snapshots: { storageKey: STORAGE_KEYS.STOCK_SNAPSHOTS, eventName: 'joulane:stockSnapshotsUpdated' },
  stock_audits: { storageKey: STORAGE_KEYS.STOCK_AUDITS, eventName: 'joulane:stockAuditsUpdated' },
  stock_approvals: { storageKey: STORAGE_KEYS.STOCK_APPROVALS, eventName: 'joulane:stockApprovalsUpdated' },
  product_order_stats: { storageKey: STORAGE_KEYS.PRODUCT_ORDER_STATS, eventName: 'joulane:productOrderStatsUpdated' },
  users: { storageKey: STORAGE_KEYS.USERS, eventName: 'joulane:usersUpdated' }
};

const PRIVATE_CONFIG_KEYS = new Set([
  'supabaseUrl',
  'supabaseAnonKey',
  'supabaseEnabled',
  'adminPasscode'
]);

function configForCloud(config) {
  const safeConfig = { ...config, _savedAt: new Date().toISOString() };
  PRIVATE_CONFIG_KEYS.forEach(key => delete safeConfig[key]);
  return safeConfig;
}

function bytesToBase64(bytes) {
  let binary = '';
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

function applyCloudRecord(key, data, dispatchEvent = true) {
  const record = CLOUD_RECORDS[key];
  if (!record || data === undefined || data === null) return false;

  let value = data;
  if (key === 'products' && Array.isArray(data)) {
    value = data.map(normalizeCatalogProduct);
  }
  if (key === 'config') {
    const localRaw = localStorage.getItem(STORAGE_KEYS.CONFIG);
    let localConfig = {};
    try {
      localConfig = localRaw ? JSON.parse(localRaw) : {};
    } catch (e) {
      console.warn('Could not parse local config while applying cloud data:', e);
    }

    const publicConfig = { ...data };
    PRIVATE_CONFIG_KEYS.forEach(privateKey => delete publicConfig[privateKey]);
    delete publicConfig._savedAt;
    value = {
      ...DEFAULT_CONFIG,
      ...localConfig,
      ...publicConfig,
      supabaseUrl: localConfig.supabaseUrl || DEFAULT_CONFIG.supabaseUrl,
      supabaseAnonKey: localConfig.supabaseAnonKey || DEFAULT_CONFIG.supabaseAnonKey,
      supabaseEnabled: localConfig.supabaseEnabled ?? DEFAULT_CONFIG.supabaseEnabled,
      adminPasscode: localConfig.adminPasscode || DEFAULT_CONFIG.adminPasscode
    };
  }

  localStorage.setItem(record.storageKey, JSON.stringify(value));
  if (key === 'products') {
    localStorage.setItem(STORAGE_KEYS.PRODUCTS_VERSION, PRODUCT_CATALOG_VERSION);
  }
  if (dispatchEvent) {
    window.dispatchEvent(new CustomEvent(record.eventName, { detail: value }));
  }
  return true;
}

function persistOrdersLocally(orders, dispatchEvent = true) {
  const safeOrders = Array.isArray(orders) ? orders : [];
  localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(safeOrders));
  localStorage.removeItem('youlan_orders');
  if (dispatchEvent) {
    window.dispatchEvent(new CustomEvent('joulane:ordersUpdated', { detail: safeOrders }));
  }
  return safeOrders;
}

function pendingOrderKey(action, orderId) {
  return `order:${action}:${encodeURIComponent(String(orderId || ''))}`;
}

function orderSyncOutcome(status, details = {}) {
  return { status, ...details };
}

function orderSyncSucceeded(result) {
  return result?.status === 'synced';
}

export const Store = {
  _cloudHydrated: false,
  _initializingCloud: null,
  _pendingSyncFlush: null,
  _orderMutationChains: new Map(),

  // Supabase Integration
  async initSupabase(refreshFn, options = {}) {
    const config = this.getConfig();
    if (!config.supabaseEnabled || !config.supabaseUrl || !config.supabaseAnonKey) return false;

    const force = options.force === true;
    if (!force && this._cloudHydrated && SupabaseManager.isConnectedTo(config.supabaseUrl, config.supabaseAnonKey)) {
      return true;
    }
    if (this._initializingCloud) return this._initializingCloud;

    this._initializingCloud = (async () => {
      const client = SupabaseManager.init(config.supabaseUrl, config.supabaseAnonKey, (key, data) => {
        if (applyCloudRecord(key, data)) {
          if (refreshFn) refreshFn();
          window.dispatchEvent(new CustomEvent('joulane:refreshStore'));
        }
      });

      if (!client) return false;

      const remoteData = await SupabaseManager.fetchAllData();
      if (remoteData === null) {
        window.dispatchEvent(new CustomEvent('joulane:syncStatus', {
          detail: { connected: false, message: 'تعذر قراءة بيانات Supabase.' }
        }));
        return false;
      }

      Object.entries(CLOUD_RECORDS).forEach(([key]) => {
        if (Object.prototype.hasOwnProperty.call(remoteData, key)) {
          applyCloudRecord(key, remoteData[key]);
        }
      });

      if (SupabaseManager.hasSecureSession('stock')) {
        const stockProData = await SupabaseManager.fetchStockProData();
        if (stockProData) {
          Object.entries(stockProData).forEach(([key, value]) => applyCloudRecord(key, value));
        }
      }

      // Migrate existing browser/app data to the cloud only when a cloud row is absent.
      for (const [key, record] of Object.entries(CLOUD_RECORDS)) {
        if (Object.prototype.hasOwnProperty.call(remoteData, key)) continue;
        if (['stock_locations', 'stock_pro_settings', 'stock_snapshots', 'stock_audits', 'stock_approvals', 'product_order_stats'].includes(key)) continue;
        if (['stock_notification_settings', 'stock_receipt_deliveries'].includes(key)) continue;
        if (['orders', 'stock_logs', 'users', 'stock_notification_settings', 'stock_receipt_deliveries'].includes(key) && !SupabaseManager.hasSecureSession()) continue;
        const localValue = localStorage.getItem(record.storageKey);
        if (!localValue) continue;

        try {
          const parsed = JSON.parse(localValue);
          const payload = key === 'config' ? configForCloud(parsed) : parsed;
          if (key === 'orders' && Array.isArray(payload)) {
            for (const order of payload) {
              const migrated = await SupabaseManager.submitOrder(order);
              if (!migrated) this.queuePendingSync(`order:${order.id}`, order);
            }
          } else {
            const migrated = await SupabaseManager.pushData(key, payload);
            if (!migrated) this.queuePendingSync(key, payload);
          }
        } catch (e) {
          console.warn(`Could not migrate local ${key} data to Supabase:`, e);
        }
      }

      this._cloudHydrated = true;
      const pendingSyncComplete = await this.flushPendingSync();
      await this.flushOfflineStockMovements();

      if (refreshFn) refreshFn();
      window.dispatchEvent(new CustomEvent('joulane:refreshStore'));
      window.dispatchEvent(new CustomEvent('joulane:syncStatus', {
        detail: {
          connected: true,
          message: pendingSyncComplete
            ? 'تمت مزامنة البيانات مع Supabase.'
            : 'تم الاتصال بالسحابة، لكن توجد عمليات محلية لم تُزامن بعد أو تعارض يحتاج المراجعة.'
        }
      }));
      return true;
    })();

    try {
      return await this._initializingCloud;
    } finally {
      this._initializingCloud = null;
    }
  },

  async ensureSupabaseConnection() {
    const config = this.getConfig();
    if (!config.supabaseEnabled || !config.supabaseUrl || !config.supabaseAnonKey) return false;

    if (SupabaseManager.isConnectedTo(config.supabaseUrl, config.supabaseAnonKey)) return true;

    const client = SupabaseManager.init(config.supabaseUrl, config.supabaseAnonKey, (key, data) => {
      if (applyCloudRecord(key, data)) {
        window.dispatchEvent(new CustomEvent('joulane:refreshStore'));
      }
    });
    this._cloudHydrated = false;
    return !!client;
  },

  queuePendingSync(key, data) {
    let pending = {};
    try {
      pending = JSON.parse(localStorage.getItem(STORAGE_KEYS.PENDING_SYNC) || '{}');
    } catch (e) {
      console.warn('Could not read pending sync queue:', e);
    }
    pending[key] = { data, queuedAt: new Date().toISOString() };
    localStorage.setItem(STORAGE_KEYS.PENDING_SYNC, JSON.stringify(pending));
  },

  queuePendingOrderUpdate(orderId, updates, expectedUpdatedAt = null, localUpdatedAt = null) {
    let pending = {};
    try {
      pending = JSON.parse(localStorage.getItem(STORAGE_KEYS.PENDING_SYNC) || '{}');
    } catch (e) {
      console.warn('Could not read pending order update queue:', e);
    }

    const legacyCreateKey = `order:${orderId}`;
    const createKey = pendingOrderKey('create', orderId);
    const updateKey = pendingOrderKey('update', orderId);
    const deleteKey = pendingOrderKey('delete', orderId);
    const rawUpdates = updates && typeof updates === 'object' && !Array.isArray(updates) ? updates : {};
    const { id: _ignoredId, updatedAt: _ignoredUpdatedAt, ...safeUpdates } = rawUpdates;

    if (pending[deleteKey]) return;
    if (pending[legacyCreateKey] || pending[createKey]) {
      const activeKey = pending[createKey] ? createKey : legacyCreateKey;
      pending[activeKey] = {
        data: {
          ...pending[activeKey].data,
          ...safeUpdates,
          id: orderId,
          ...(localUpdatedAt ? { updatedAt: localUpdatedAt } : {})
        },
        queuedAt: new Date().toISOString()
      };
    } else {
      const previousData = pending[updateKey]?.data || {};
      pending[updateKey] = {
        data: {
          orderId,
          updates: { ...(previousData.updates || {}), ...safeUpdates },
          expectedUpdatedAt: Object.prototype.hasOwnProperty.call(previousData, 'expectedUpdatedAt')
            ? previousData.expectedUpdatedAt
            : (expectedUpdatedAt || null),
          localUpdatedAt: localUpdatedAt || previousData.localUpdatedAt || null
        },
        queuedAt: new Date().toISOString()
      };
    }
    localStorage.setItem(STORAGE_KEYS.PENDING_SYNC, JSON.stringify(pending));
  },

  queuePendingOrderDelete(orderId, expectedUpdatedAt = null) {
    let pending = {};
    try {
      pending = JSON.parse(localStorage.getItem(STORAGE_KEYS.PENDING_SYNC) || '{}');
    } catch (e) {
      console.warn('Could not read pending order deletion queue:', e);
    }

    const updateKey = pendingOrderKey('update', orderId);
    const queuedExpectedUpdatedAt = Object.prototype.hasOwnProperty.call(pending[updateKey]?.data || {}, 'expectedUpdatedAt')
      ? pending[updateKey].data.expectedUpdatedAt
      : expectedUpdatedAt;
    delete pending[`order:${orderId}`];
    delete pending[pendingOrderKey('create', orderId)];
    delete pending[updateKey];
    pending[pendingOrderKey('delete', orderId)] = {
      data: { orderId, expectedUpdatedAt: queuedExpectedUpdatedAt || null },
      queuedAt: new Date().toISOString()
    };
    localStorage.setItem(STORAGE_KEYS.PENDING_SYNC, JSON.stringify(pending));
  },

  queuePendingOrdersClear(orderIds) {
    const capturedIds = [...new Set((Array.isArray(orderIds) ? orderIds : [])
      .map(id => String(id || '').trim())
      .filter(Boolean))];
    if (!capturedIds.length) return;

    let pending = {};
    try {
      pending = JSON.parse(localStorage.getItem(STORAGE_KEYS.PENDING_SYNC) || '{}');
    } catch (e) {
      console.warn('Could not read pending order clearing queue:', e);
    }

    const targetIds = new Set(capturedIds);
    Object.entries(pending).forEach(([key, item]) => {
      if (!key.startsWith('order:')) return;
      const queuedOrderId = String(item?.data?.orderId || item?.data?.id || '').trim();
      if (targetIds.has(queuedOrderId)) delete pending[key];
    });

    const previousIds = Array.isArray(pending['orders:clear']?.data?.orderIds)
      ? pending['orders:clear'].data.orderIds
      : [];
    pending['orders:clear'] = {
      data: { orderIds: [...new Set([...previousIds, ...capturedIds])] },
      queuedAt: new Date().toISOString()
    };
    localStorage.setItem(STORAGE_KEYS.PENDING_SYNC, JSON.stringify(pending));
  },

  async pushToCloud(key, data) {
    const payload = key === 'config' ? configForCloud(data) : data;
    if (key === 'orders') {
      this.queuePendingSync('orders', Array.isArray(payload) ? payload : []);
      const connected = await this.ensureSupabaseConnection();
      if (!connected) return false;
      return this.flushPendingSync();
    }
    const connected = await this.ensureSupabaseConnection();
    if (!connected) {
      this.queuePendingSync(key, payload);
      return false;
    }

    const ok = await SupabaseManager.pushData(key, payload);
    if (!ok) this.queuePendingSync(key, payload);
    return ok;
  },

  async refreshOrderFromCloud(orderId) {
    const remoteOrders = await SupabaseManager.fetchOrders();
    if (!Array.isArray(remoteOrders)) return { refreshed: false, order: null };

    const normalizedId = String(orderId || '');
    const remoteOrder = remoteOrders.find(order => String(order?.id || '') === normalizedId) || null;
    const localOrders = this.getOrders();
    const localIndex = localOrders.findIndex(order => String(order?.id || '') === normalizedId);

    if (remoteOrder) {
      if (localIndex === -1) localOrders.unshift(remoteOrder);
      else localOrders[localIndex] = remoteOrder;
    } else if (localIndex !== -1) {
      localOrders.splice(localIndex, 1);
    }
    persistOrdersLocally(localOrders);
    return { refreshed: true, order: remoteOrder };
  },

  async flushPendingSync() {
    if (this._pendingSyncFlush) return this._pendingSyncFlush;
    this._pendingSyncFlush = this._flushPendingSyncOnce();
    try {
      return await this._pendingSyncFlush;
    } finally {
      this._pendingSyncFlush = null;
    }
  },

  async _flushPendingSyncOnce() {
    let pending = {};
    try {
      pending = JSON.parse(localStorage.getItem(STORAGE_KEYS.PENDING_SYNC) || '{}');
    } catch (e) {
      console.warn('Could not parse pending sync queue:', e);
      return false;
    }

    const entries = Object.entries(pending).sort(([leftKey], [rightKey]) => {
      const priority = key => {
        if (/^order:(create:)?/.test(key) && !key.startsWith('order:update:') && !key.startsWith('order:delete:')) return 0;
        if (key.startsWith('order:update:')) return 1;
        if (key.startsWith('order:delete:')) return 2;
        if (key === 'orders:clear') return 3;
        if (key === 'orders') return 4;
        return 5;
      };
      return priority(leftKey) - priority(rightKey);
    });
    if (!entries.length) return true;

    let encounteredTerminalFailure = false;
    for (const [key, item] of entries) {
      let ok = false;
      let result = false;
      const queuedEntryIsCurrent = () => {
        try {
          const latest = JSON.parse(localStorage.getItem(STORAGE_KEYS.PENDING_SYNC) || '{}');
          return latest[key]?.queuedAt === item.queuedAt;
        } catch (_) {
          return false;
        }
      };
      const rebaseSupersedingQueuedUpdate = updatedAt => {
        if (!updatedAt) return;
        try {
          const latest = JSON.parse(localStorage.getItem(STORAGE_KEYS.PENDING_SYNC) || '{}');
          if (!latest[key] || latest[key]?.queuedAt === item.queuedAt) return;
          latest[key].data = { ...(latest[key].data || {}), expectedUpdatedAt: updatedAt };
          localStorage.setItem(STORAGE_KEYS.PENDING_SYNC, JSON.stringify(latest));
        } catch (_) {
          // The newer operation remains queued with its original version token.
        }
      };

      if (key.startsWith('order:update:')) {
        result = await SupabaseManager.updateOrder(
          item.data?.orderId,
          item.data?.updates || {},
          item.data?.expectedUpdatedAt || null
        );
        ok = result?.status === 'updated';
        if (result?.status === 'updated' && result.order) {
          if (queuedEntryIsCurrent()) {
            const localOrders = this.getOrders();
            const localIndex = localOrders.findIndex(order => order.id === result.order.id);
            const currentUpdatedAt = localOrders[localIndex]?.updatedAt || null;
            const matchesQueuedLocal = !item.data?.localUpdatedAt || currentUpdatedAt === item.data.localUpdatedAt;
            const matchesHydratedRemote = currentUpdatedAt === (item.data?.expectedUpdatedAt || null);
            if (localIndex !== -1 && (matchesQueuedLocal || matchesHydratedRemote)) {
              localOrders[localIndex] = result.order;
              persistOrdersLocally(localOrders);
            }
          } else {
            rebaseSupersedingQueuedUpdate(result.order.updatedAt);
          }
          if (result.stockApplied) await this.refreshSecureStockState();
        } else if (['conflict', 'not_found'].includes(result?.status)) {
          if (!queuedEntryIsCurrent()) continue;
          const refreshed = await this.refreshOrderFromCloud(item.data?.orderId);
          ok = true;
          encounteredTerminalFailure = true;
          window.dispatchEvent(new CustomEvent('joulane:orderSyncResult', {
            detail: orderSyncOutcome('conflict', {
              operation: 'update',
              orderId: item.data?.orderId,
              reason: result.status,
              refreshed: refreshed.refreshed
            })
          }));
        } else if (result?.status === 'forbidden') {
          if (!queuedEntryIsCurrent()) continue;
          ok = true;
          encounteredTerminalFailure = true;
          window.dispatchEvent(new CustomEvent('joulane:orderSyncResult', {
            detail: orderSyncOutcome('forbidden', { operation: 'update', orderId: item.data?.orderId })
          }));
        }
      } else if (key.startsWith('order:delete:')) {
        result = await SupabaseManager.deleteOrder(item.data?.orderId, item.data?.expectedUpdatedAt || null);
        ok = result?.status === 'deleted';
        if (result?.status === 'deleted' && queuedEntryIsCurrent()) {
          persistOrdersLocally(this.getOrders().filter(order => order.id !== item.data?.orderId));
        } else if (['conflict', 'not_found'].includes(result?.status)) {
          if (!queuedEntryIsCurrent()) continue;
          const refreshed = await this.refreshOrderFromCloud(item.data?.orderId);
          ok = true;
          encounteredTerminalFailure = true;
          window.dispatchEvent(new CustomEvent('joulane:orderSyncResult', {
            detail: orderSyncOutcome('conflict', {
              operation: 'delete',
              orderId: item.data?.orderId,
              reason: result.status,
              refreshed: refreshed.refreshed
            })
          }));
        } else if (result?.status === 'forbidden') {
          if (!queuedEntryIsCurrent()) continue;
          ok = true;
          encounteredTerminalFailure = true;
          window.dispatchEvent(new CustomEvent('joulane:orderSyncResult', {
            detail: orderSyncOutcome('forbidden', { operation: 'delete', orderId: item.data?.orderId })
          }));
        }
      } else if (key === 'orders:clear') {
        const orderIds = Array.isArray(item.data?.orderIds) ? item.data.orderIds : [];
        result = await SupabaseManager.clearOrders(orderIds);
        ok = result?.status === 'cleared';
        if (ok && queuedEntryIsCurrent()) {
          const idSet = new Set(orderIds);
          persistOrdersLocally(this.getOrders().filter(order => !idSet.has(order.id)));
        } else if (result?.status === 'forbidden') {
          if (!queuedEntryIsCurrent()) continue;
          ok = true;
          encounteredTerminalFailure = true;
          window.dispatchEvent(new CustomEvent('joulane:orderSyncResult', {
            detail: orderSyncOutcome('forbidden', { operation: 'clear' })
          }));
        }
      } else if (key === 'orders' && Array.isArray(item.data)) {
        // Legacy clients queued a complete array. Replay every visible order
        // individually and never delete remote orders that were not in that stale
        // snapshot.
        ok = true;
        for (const order of item.data) {
          result = await SupabaseManager.updateOrder(order.id, order, order.updatedAt || null);
          if (['conflict', 'not_found'].includes(result?.status)) {
            const refreshed = await this.refreshOrderFromCloud(order.id);
            encounteredTerminalFailure = true;
            window.dispatchEvent(new CustomEvent('joulane:orderSyncResult', {
              detail: orderSyncOutcome('conflict', {
                operation: 'update', orderId: order.id, reason: result.status, refreshed: refreshed.refreshed
              })
            }));
            continue;
          }
          if (result?.status === 'forbidden') {
            encounteredTerminalFailure = true;
            window.dispatchEvent(new CustomEvent('joulane:orderSyncResult', {
              detail: orderSyncOutcome('forbidden', { operation: 'update', orderId: order.id })
            }));
            continue;
          }
          if (result?.status !== 'updated') {
            ok = false;
            break;
          }
        }
      } else if (key.startsWith('order:create:') || key.startsWith('order:')) {
        ok = await SupabaseManager.submitOrder(item.data);
        if (ok && queuedEntryIsCurrent() && item.data?.id && !this.getOrders().some(order => order.id === item.data.id)) {
          persistOrdersLocally([item.data, ...this.getOrders()]);
        }
      } else {
        ok = await SupabaseManager.pushData(key, item.data);
        if (ok) applyCloudRecord(key, item.data, false);
      }

      if (ok) {
        // Do not erase an operation that was updated while this network request
        // was in flight.
        let latest = {};
        try {
          latest = JSON.parse(localStorage.getItem(STORAGE_KEYS.PENDING_SYNC) || '{}');
        } catch (_) {
          latest = {};
        }
        if (latest[key]?.queuedAt === item.queuedAt) {
          delete latest[key];
          localStorage.setItem(STORAGE_KEYS.PENDING_SYNC, JSON.stringify(latest));
        }
      }
    }

    try {
      pending = JSON.parse(localStorage.getItem(STORAGE_KEYS.PENDING_SYNC) || '{}');
    } catch (_) {
      pending = {};
    }
    return Object.keys(pending).length === 0 && !encounteredTerminalFailure;
  },

  // Config
  getConfig() {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CONFIG);
      const merged = saved ? { ...DEFAULT_CONFIG, ...JSON.parse(saved) } : { ...DEFAULT_CONFIG };
      // Always use hardcoded Supabase credentials - never allow empty values to override them
      if (!merged.supabaseUrl || !merged.supabaseAnonKey) {
        merged.supabaseUrl = DEFAULT_CONFIG.supabaseUrl;
        merged.supabaseAnonKey = DEFAULT_CONFIG.supabaseAnonKey;
        merged.supabaseEnabled = DEFAULT_CONFIG.supabaseEnabled;
      }
      return merged;
    } catch (e) {
      console.error('Error reading site config:', e);
      return { ...DEFAULT_CONFIG };
    }
  },
  async saveConfig(config) {
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(config));
    window.dispatchEvent(new CustomEvent('joulane:configUpdated', { detail: config }));
    return this.pushToCloud('config', config);
  },

  // Passcode
  getPasscode() {
    return localStorage.getItem(STORAGE_KEYS.PASSCODE) || this.getConfig().adminPasscode || '';
  },
  setPasscode(newPass) {
    localStorage.setItem(STORAGE_KEYS.PASSCODE, newPass);
    const config = this.getConfig();
    config.adminPasscode = newPass;
    this.saveConfig(config);
    try {
      const currentUser = JSON.parse(sessionStorage.getItem('joulane_current_user') || 'null');
      if (currentUser?.id) {
        const users = this.getUsers().map(user => ({
          ...user,
          passcode: user.id === currentUser.id ? newPass : ''
        }));
        this.saveUsers(users);
      }
    } catch (error) {
      console.warn('Could not update the secure staff passcode:', error);
    }
  },

  // Categories Management
  getCategories() {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error('Error reading categories:', e);
    }
    return DEFAULT_CATEGORIES;
  },
  saveCategories(categories) {
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
    this.pushToCloud('categories', categories);
    window.dispatchEvent(new CustomEvent('joulane:categoriesUpdated', { detail: categories }));
  },
  addCategory(category) {
    const categories = this.getCategories();
    const index = categories.findIndex(c => c.id === category.id);
    if (index !== -1) {
      categories[index] = category;
    } else {
      categories.push(category);
    }
    this.saveCategories(categories);
    return categories;
  },
  updateCategory(id, updates = {}) {
    const categories = this.getCategories();
    const index = categories.findIndex(category => category.id === id);
    if (index === -1) return null;
    const nameAr = String(updates.nameAr || '').trim();
    const nameFr = String(updates.nameFr || '').trim();
    if (!nameAr || !nameFr) return null;
    categories[index] = {
      ...categories[index],
      nameAr,
      nameFr
    };
    this.saveCategories(categories);
    return categories[index];
  },
  deleteCategory(id) {
    let categories = this.getCategories();
    categories = categories.filter(c => c.id !== id);
    this.saveCategories(categories);
    return categories;
  },

  // Products
  getProducts() {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
      const savedVersion = localStorage.getItem(STORAGE_KEYS.PRODUCTS_VERSION);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0 && savedVersion === PRODUCT_CATALOG_VERSION) {
          // Check for products with old local image paths
          const hasLocalImages = parsed.some(p => {
            const img = p?.image || '';
            return img.startsWith('/') || img.includes('/images/');
          });
          if (hasLocalImages) {
            console.warn('⚠️  Detected products with local image URLs, refreshing from Cloudinary source...');
            // Continue to fallback below to load from products.js
          } else {
            return parsed.map(normalizeCatalogProduct);
          }
        }
      }
    } catch (e) {
      console.warn('Could not read cached products, reloading from source:', e?.message || e);
    }
    const availableProducts = PRODUCTS.map(normalizeCatalogProduct);
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(availableProducts));
    localStorage.setItem(STORAGE_KEYS.PRODUCTS_VERSION, PRODUCT_CATALOG_VERSION);
    return availableProducts;
  },

  getProductOrderStats() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.PRODUCT_ORDER_STATS) || '{}');
      return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
    } catch (_) {
      return {};
    }
  },
  saveProducts(products) {
    const normalizedProducts = (Array.isArray(products) ? products : []).map(normalizeCatalogProduct);
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(normalizedProducts));
    localStorage.setItem(STORAGE_KEYS.PRODUCTS_VERSION, PRODUCT_CATALOG_VERSION);
    this.pushToCloud('products', normalizedProducts);
    window.dispatchEvent(new CustomEvent('joulane:productsUpdated', { detail: normalizedProducts }));
  },
  addProduct(newProduct) {
    const products = this.getProducts();
    products.unshift({ ...newProduct, isAvailable: newProduct?.isAvailable !== false });
    this.saveProducts(products);
    return products;
  },
  updateProduct(id, updatedFields) {
    const products = this.getProducts();
    const index = products.findIndex(p => p.id === id);
    if (index !== -1) {
      products[index] = { ...products[index], ...updatedFields };
      this.saveProducts(products);
    }
    return products;
  },
  async setProductAvailability(id, isAvailable) {
    const products = this.getProducts();
    const index = products.findIndex(product => product.id === id);
    if (index === -1) return false;
    products[index] = { ...products[index], isAvailable: isAvailable === true };
    const saved = await this.pushToCloud('products', products);
    if (!saved) return false;
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
    localStorage.setItem(STORAGE_KEYS.PRODUCTS_VERSION, PRODUCT_CATALOG_VERSION);
    window.dispatchEvent(new CustomEvent('joulane:productsUpdated', { detail: products }));
    window.dispatchEvent(new CustomEvent('joulane:refreshStore'));
    return true;
  },
  deleteProduct(id) {
    let products = this.getProducts();
    products = products.filter(p => p.id !== id);
    this.saveProducts(products);
    return products;
  },

  // Shopping Cart System
  getCart() {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CART);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Error reading cart:', e);
    }
    return [];
  },
  saveCart(cart) {
    localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(cart));
    window.dispatchEvent(new CustomEvent('joulane:cartUpdated', { detail: cart }));
  },
  addToCart(product, colors, seriesQty = 1) {
    const cart = this.getCart();
    const selectedColors = (Array.isArray(colors) ? colors : [colors])
      .map(color => String(color || '').trim())
      .filter(Boolean);
    if (!selectedColors.length) selectedColors.push('تشكيلة حسب الموديل');
    const colorVariants = [
      ...(Array.isArray(product.colors?.ar) ? [product.colors.ar] : []),
      ...(Array.isArray(product.colors?.fr) ? [product.colors.fr] : [])
    ];
    const canonicalColorToken = color => {
      for (const variant of colorVariants) {
        const index = variant.indexOf(color);
        if (index >= 0) return `color-${index}`;
      }
      return String(color).toLocaleLowerCase();
    };
    const colorKey = selectedColors.map(canonicalColorToken).sort().join('|');
    const existingIndex = cart.findIndex(item => {
      const itemColors = (Array.isArray(item.colors) && item.colors.length ? item.colors : [item.color || 'تشكيلة حسب الموديل'])
        .map(canonicalColorToken)
        .sort()
        .join('|');
      return item.productId === product.id && itemColors === colorKey;
    });
    
    if (existingIndex !== -1) {
      cart[existingIndex].seriesQty += seriesQty;
      cart[existingIndex].totalPrice = cart[existingIndex].seriesQty * cart[existingIndex].seriesPrice;
    } else {
      cart.push({
        productId: product.id,
        nameAr: product.name?.ar || product.name || 'منتج',
        nameFr: product.name?.fr || product.name || 'Produit',
        image: (Array.isArray(product.images) && product.images.length ? product.images[0] : product.image) || 'https://res.cloudinary.com/q3ncbdqa/image/upload/f_auto,q_auto,c_limit,w_1200/v1785955417/joulane/products/azsvctjhsfzzhmr4xeev.jpg',
        colors: selectedColors,
        color: selectedColors.join(' + '),
        seriesQty: seriesQty,
        pairsPerSeries: product.pairsPerSeries || PAIRS_PER_CARTON,
        seriesPrice: product.seriesPrice || 0,
        totalPrice: seriesQty * (product.seriesPrice || 0)
      });
    }
    
    this.saveCart(cart);
    return cart;
  },
  updateCartColors(index, colors) {
    const cart = this.getCart();
    const selectedColors = (Array.isArray(colors) ? colors : [colors])
      .map(color => String(color || '').trim())
      .filter(Boolean);
    if (cart[index] && selectedColors.length) {
      cart[index].colors = selectedColors;
      cart[index].color = selectedColors.join(' + ');
      this.saveCart(cart);
    }
    return cart;
  },
  updateCartQty(index, newQty) {
    const cart = this.getCart();
    if (index >= 0 && index < cart.length) {
      if (newQty <= 0) {
        cart.splice(index, 1);
      } else {
        cart[index].seriesQty = newQty;
        cart[index].totalPrice = newQty * cart[index].seriesPrice;
      }
      this.saveCart(cart);
    }
    return cart;
  },
  removeFromCart(index) {
    const cart = this.getCart();
    if (index >= 0 && index < cart.length) {
      cart.splice(index, 1);
      this.saveCart(cart);
    }
    return cart;
  },
  clearCart() {
    localStorage.removeItem(STORAGE_KEYS.CART);
    this.saveCart([]);
  },
  getCartCount() {
    const cart = this.getCart();
    return cart.reduce((sum, item) => sum + item.seriesQty, 0);
  },
  getCartTotal() {
    const cart = this.getCart();
    return cart.reduce((sum, item) => sum + item.totalPrice, 0);
  },

  // Orders
  getOrders() {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ORDERS) || localStorage.getItem('youlan_orders');
      if (saved) {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch (e) {
      console.error('Error reading orders:', e);
    }
    return [];
  },
  saveOrders(orders) {
    const previousOrders = this.getOrders();
    const nextOrders = persistOrdersLocally(orders);
    void this.syncOrderCollection(previousOrders, nextOrders);
    return nextOrders;
  },
  async _runOrderMutation(orderId, mutation) {
    const key = String(orderId || '');
    const previous = this._orderMutationChains.get(key) || Promise.resolve();
    const current = previous.catch(() => undefined).then(mutation);
    this._orderMutationChains.set(key, current);
    try {
      return await current;
    } finally {
      if (this._orderMutationChains.get(key) === current) this._orderMutationChains.delete(key);
    }
  },
  async syncOrderCollection(previousOrders, nextOrders) {
    const previous = Array.isArray(previousOrders) ? previousOrders : [];
    const next = Array.isArray(nextOrders) ? nextOrders : [];
    const previousById = new Map(previous.map(order => [order.id, order]));
    const nextById = new Map(next.map(order => [order.id, order]));

    if (!next.length && previous.length) {
      return orderSyncSucceeded(await this.syncOrderClear(previous.map(order => order.id)));
    }

    let success = true;
    for (const order of next) {
      if (!previousById.has(order.id)) {
        if (!await this.submitOrder(order)) success = false;
      } else if (JSON.stringify(previousById.get(order.id)) !== JSON.stringify(order)) {
        const { id: _ignoredId, ...updates } = order;
        const result = await this.syncOrderUpdate(
          order.id,
          updates,
          previousById.get(order.id)?.updatedAt || null,
          order.updatedAt || null
        );
        if (!orderSyncSucceeded(result)) success = false;
      }
    }
    for (const order of previous) {
      if (!nextById.has(order.id)) {
        const result = await this.syncOrderDelete(order.id, order.updatedAt || null);
        if (!orderSyncSucceeded(result)) success = false;
      }
    }
    return success;
  },
  async syncOrderUpdate(orderId, updates, expectedUpdatedAt = null, localUpdatedAt = null) {
    const rawUpdates = updates && typeof updates === 'object' && !Array.isArray(updates) ? updates : {};
    const { id: _ignoredId, updatedAt: _ignoredUpdatedAt, ...safeUpdates } = rawUpdates;
    const connected = await this.ensureSupabaseConnection();
    if (!connected || !SupabaseManager.hasSecureSession('admin')) {
      this.queuePendingOrderUpdate(orderId, safeUpdates, expectedUpdatedAt, localUpdatedAt);
      return orderSyncOutcome('queued', { operation: 'update', orderId });
    }
    const result = await SupabaseManager.updateOrder(orderId, safeUpdates, expectedUpdatedAt);
    if (result?.status === 'updated') {
      if (result.order) {
        const orders = this.getOrders();
        const orderIndex = orders.findIndex(order => order.id === orderId);
        if (orderIndex !== -1 && (!localUpdatedAt || orders[orderIndex]?.updatedAt === localUpdatedAt)) {
          orders[orderIndex] = result.order;
          persistOrdersLocally(orders);
        }
      }
      if (result.stockApplied) await this.refreshSecureStockState();
      return orderSyncOutcome('synced', {
        operation: 'update',
        orderId,
        order: result.order || null,
        stockApplied: result.stockApplied === true,
        stockMovementCount: Number(result.stockMovementCount) || 0
      });
    }
    if (['conflict', 'not_found'].includes(result?.status)) {
      const refreshed = await this.refreshOrderFromCloud(orderId);
      return orderSyncOutcome('conflict', {
        operation: 'update', orderId, reason: result.status, refreshed: refreshed.refreshed, order: refreshed.order
      });
    }
    if (result?.status === 'forbidden') {
      return orderSyncOutcome('forbidden', { operation: 'update', orderId });
    }
    this.queuePendingOrderUpdate(orderId, safeUpdates, expectedUpdatedAt, localUpdatedAt);
    return orderSyncOutcome('queued', { operation: 'update', orderId });
  },
  async syncOrderDelete(orderId, expectedUpdatedAt = null) {
    const connected = await this.ensureSupabaseConnection();
    if (!connected || !SupabaseManager.hasSecureSession('admin')) {
      this.queuePendingOrderDelete(orderId, expectedUpdatedAt);
      return orderSyncOutcome('queued', { operation: 'delete', orderId });
    }
    const result = await SupabaseManager.deleteOrder(orderId, expectedUpdatedAt);
    if (result?.status === 'deleted') return orderSyncOutcome('synced', { operation: 'delete', orderId });
    if (['conflict', 'not_found'].includes(result?.status)) {
      const refreshed = await this.refreshOrderFromCloud(orderId);
      return orderSyncOutcome('conflict', {
        operation: 'delete', orderId, reason: result.status, refreshed: refreshed.refreshed, order: refreshed.order
      });
    }
    if (result?.status === 'forbidden') {
      return orderSyncOutcome('forbidden', { operation: 'delete', orderId });
    }
    this.queuePendingOrderDelete(orderId, expectedUpdatedAt);
    return orderSyncOutcome('queued', { operation: 'delete', orderId });
  },
  async syncOrderClear(orderIds) {
    const capturedIds = [...new Set((Array.isArray(orderIds) ? orderIds : []).filter(Boolean))];
    if (!capturedIds.length) return orderSyncOutcome('synced', { operation: 'clear' });
    const connected = await this.ensureSupabaseConnection();
    if (!connected || !SupabaseManager.hasSecureSession('admin')) {
      this.queuePendingOrdersClear(capturedIds);
      return orderSyncOutcome('queued', { operation: 'clear' });
    }
    const result = await SupabaseManager.clearOrders(capturedIds);
    if (result?.status === 'cleared') {
      return orderSyncOutcome('synced', { operation: 'clear', clearedCount: result.clearedCount || 0 });
    }
    if (result?.status === 'forbidden') return orderSyncOutcome('forbidden', { operation: 'clear' });
    this.queuePendingOrdersClear(capturedIds);
    return orderSyncOutcome('queued', { operation: 'clear' });
  },
  async submitOrder(order) {
    const connected = await this.ensureSupabaseConnection();
    if (!connected) {
      this.queuePendingSync(pendingOrderKey('create', order.id), order);
      return false;
    }
    const ok = await SupabaseManager.submitOrder(order);
    if (!ok) this.queuePendingSync(pendingOrderKey('create', order.id), order);
    return ok;
  },
  async addOrder(order) {
    const orders = this.getOrders();
    orders.unshift(order);
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
    window.dispatchEvent(new CustomEvent('joulane:ordersUpdated', { detail: orders }));
    return this.submitOrder(order);
  },
  async trackOrder(trackingCode) {
    const connected = await this.ensureSupabaseConnection();
    if (!connected) return { status: 'unavailable' };
    return SupabaseManager.trackOrder(trackingCode);
  },
  async updateOrder(orderId, updatedFields = {}) {
    return this._runOrderMutation(orderId, async () => {
      const orders = this.getOrders();
      const orderIndex = orders.findIndex(order => order.id === orderId);
      if (orderIndex === -1 || !updatedFields || typeof updatedFields !== 'object' || Array.isArray(updatedFields)) {
        return orderSyncOutcome('conflict', { operation: 'update', orderId, reason: 'not_found', orders });
      }

      const expectedUpdatedAt = orders[orderIndex].updatedAt || null;
      const { id: _ignoredId, updatedAt: _ignoredUpdatedAt, ...safeUpdates } = updatedFields;
      const localUpdatedAt = new Date().toISOString();
      orders[orderIndex] = {
        ...orders[orderIndex],
        ...safeUpdates,
        id: orders[orderIndex].id,
        updatedAt: localUpdatedAt
      };
      persistOrdersLocally(orders);
      const sync = await this.syncOrderUpdate(orderId, safeUpdates, expectedUpdatedAt, localUpdatedAt);
      return { ...sync, orders: this.getOrders() };
    });
  },
  async updateOrderStatus(orderId, newStatus) {
    const normalizedStatus = String(newStatus || '').trim();
    if (!VALID_ORDER_STATUSES.has(normalizedStatus)) {
      return orderSyncOutcome('conflict', {
        operation: 'update', orderId, reason: 'invalid_status', orders: this.getOrders()
      });
    }
    return this.updateOrder(orderId, { status: normalizedStatus });
  },
  async deleteOrder(orderId) {
    return this._runOrderMutation(orderId, async () => {
      const currentOrders = this.getOrders();
      const existing = currentOrders.find(order => order.id === orderId);
      if (!existing) {
        return orderSyncOutcome('conflict', { operation: 'delete', orderId, reason: 'not_found', orders: currentOrders });
      }
      persistOrdersLocally(currentOrders.filter(order => order.id !== orderId));
      const sync = await this.syncOrderDelete(orderId, existing.updatedAt || null);
      return { ...sync, orders: this.getOrders() };
    });
  },
  async clearOrders() {
    const orderIds = this.getOrders().map(order => order.id).filter(Boolean);
    persistOrdersLocally([]);
    const sync = await this.syncOrderClear(orderIds);
    return { ...sync, orders: this.getOrders() };
  },

  // Shipping Rates
  getShippingRates() {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SHIPPING);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Error reading shipping rates:', e);
    }
    const defaultRates = { _showPrices: false };
    WILAYAS.forEach(w => {
      defaultRates[w.code] = { homePrice: w.homePrice, deskPrice: w.deskPrice };
    });
    return defaultRates;
  },
  saveShippingRates(ratesMap) {
    localStorage.setItem(STORAGE_KEYS.SHIPPING, JSON.stringify(ratesMap));
    this.pushToCloud('shipping', ratesMap);
    window.dispatchEvent(new CustomEvent('joulane:shippingUpdated', { detail: ratesMap }));
  },

  // Stock Logs History
  getStockLogs() {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.STOCK_LOGS);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Error reading stock logs:', e);
    }
    return [];
  },
  saveStockLogs(logs) {
    localStorage.setItem(STORAGE_KEYS.STOCK_LOGS, JSON.stringify(logs));
    this.pushToCloud('stock_logs', logs);
    window.dispatchEvent(new CustomEvent('joulane:stockLogsUpdated', { detail: logs }));
  },
  addStockLog(entry) {
    const logs = this.getStockLogs();
    const now = new Date();
    const dateStr = now.toLocaleDateString('ar-DZ', { year: 'numeric', month: 'short', day: 'numeric' }) + ' ' + now.toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' });
    const newLog = {
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      timestamp: now.toISOString(),
      dateFormatted: dateStr,
      ...entry
    };
    logs.unshift(newLog);
    this.saveStockLogs(logs);
    return newLog;
  },
  async recordStockMovement(productId, productUpdates, entry) {
    const productsBefore = this.getProducts();
    const productIndex = productsBefore.findIndex(product => product.id === productId);
    if (productIndex === -1) return false;

    const productsAfter = productsBefore.map((product, index) => (
      index === productIndex ? { ...product, ...productUpdates } : product
    ));
    const logsBefore = this.getStockLogs();
    const now = new Date();
    const dateFormatted = now.toLocaleDateString('ar-DZ', { year: 'numeric', month: 'short', day: 'numeric' }) + ' ' + now.toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' });
    const newLog = {
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      timestamp: now.toISOString(),
      dateFormatted,
      ...entry
    };

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      const queued = this.getOfflineStockQueue();
      queued.push({
        id: 'offline_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        productId,
        productUpdates,
        entry: newLog,
        queuedAt: now.toISOString(),
        status: 'pending'
      });
      localStorage.setItem(STORAGE_KEYS.STOCK_OFFLINE_QUEUE, JSON.stringify(queued));
      localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(productsAfter));
      localStorage.setItem(STORAGE_KEYS.STOCK_LOGS, JSON.stringify([{ ...newLog, queuedOffline: true }, ...logsBefore]));
      window.dispatchEvent(new CustomEvent('joulane:productsUpdated', { detail: productsAfter }));
      window.dispatchEvent(new CustomEvent('joulane:stockOfflineQueueUpdated', { detail: queued }));
      return { ...newLog, queuedOffline: true };
    }

    const connected = await this.ensureSupabaseConnection();
    if (!connected || !SupabaseManager.hasSecureSession?.('stock')) return false;

    const atomicResult = await SupabaseManager.recordStockMovement(productId, productUpdates.seriesQty, newLog);
    if (!atomicResult || atomicResult.status !== 'saved') {
      if (atomicResult?.status === 'approval_required') {
        await this.refreshStockProData();
        return { approvalRequired: true, approvalId: atomicResult.approvalId };
      }
      return false;
    }

    const savedLog = atomicResult.log || newLog;

    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(productsAfter));
    localStorage.setItem(STORAGE_KEYS.PRODUCTS_VERSION, PRODUCT_CATALOG_VERSION);
    localStorage.setItem(STORAGE_KEYS.STOCK_LOGS, JSON.stringify([savedLog, ...logsBefore]));
    window.dispatchEvent(new CustomEvent('joulane:productsUpdated', { detail: productsAfter }));
    window.dispatchEvent(new CustomEvent('joulane:stockLogsUpdated', { detail: [savedLog, ...logsBefore] }));
    return savedLog;
  },
  getOfflineStockQueue() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEYS.STOCK_OFFLINE_QUEUE) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  },
  async flushOfflineStockMovements() {
    const queue = this.getOfflineStockQueue();
    if (!queue.length || !SupabaseManager.hasSecureSession?.('stock')) return queue.length === 0;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;

    const remaining = [];
    for (const item of queue) {
      const result = await SupabaseManager.recordStockMovement(
        item.productId,
        item.productUpdates?.seriesQty,
        item.entry
      );
      if (!result || !['saved', 'approval_required'].includes(result.status)) {
        remaining.push({ ...item, status: result?.status || 'conflict' });
      }
    }
    localStorage.setItem(STORAGE_KEYS.STOCK_OFFLINE_QUEUE, JSON.stringify(remaining));
    window.dispatchEvent(new CustomEvent('joulane:stockOfflineQueueUpdated', { detail: remaining }));
    if (remaining.length !== queue.length) await this.refreshSecureStockState();
    return remaining.length === 0;
  },
  async refreshStockProData() {
    const data = await SupabaseManager.fetchStockProData();
    if (!data) return false;
    Object.entries(data).forEach(([key, value]) => applyCloudRecord(key, value));
    return true;
  },
  async refreshSecureStockState() {
    const remoteData = await SupabaseManager.fetchAllData();
    if (remoteData === null) return false;
    ['products', 'stock_logs'].forEach(key => {
      if (Object.prototype.hasOwnProperty.call(remoteData, key)) applyCloudRecord(key, remoteData[key]);
    });
    await this.refreshStockProData();
    window.dispatchEvent(new CustomEvent('joulane:refreshStore'));
    return true;
  },
  getStockLocations() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEYS.STOCK_LOCATIONS) || '[]');
      return Array.isArray(value) && value.length ? value : [{ id: 'main', name: 'المخزن الرئيسي', active: true }];
    } catch (_) {
      return [{ id: 'main', name: 'المخزن الرئيسي', active: true }];
    }
  },
  getStockProSettings() {
    const defaults = { lowStockThreshold: 5, approvalThreshold: 20, undoWindowMinutes: 10, staleDays: 60 };
    try {
      return { ...defaults, ...JSON.parse(localStorage.getItem(STORAGE_KEYS.STOCK_PRO_SETTINGS) || '{}') };
    } catch (_) {
      return defaults;
    }
  },
  getStockSnapshots() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEYS.STOCK_SNAPSHOTS) || '[]');
      return Array.isArray(value) ? value : [];
    } catch (_) {
      return [];
    }
  },
  getStockAudits() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEYS.STOCK_AUDITS) || '[]');
      return Array.isArray(value) ? value : [];
    } catch (_) {
      return [];
    }
  },
  getStockApprovals() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEYS.STOCK_APPROVALS) || '[]');
      return Array.isArray(value) ? value : [];
    } catch (_) {
      return [];
    }
  },
  async saveStockLocations(locations) {
    const saved = await SupabaseManager.saveStockProData('stock_locations', locations);
    if (saved) applyCloudRecord('stock_locations', locations);
    return saved;
  },
  async saveStockProSettings(settings) {
    const saved = await SupabaseManager.saveStockProData('stock_pro_settings', settings);
    if (saved) applyCloudRecord('stock_pro_settings', settings);
    return saved;
  },
  async createStockSnapshot(reason) {
    const result = await SupabaseManager.createStockSnapshot(reason);
    if (result) await this.refreshStockProData();
    return result;
  },
  async restoreStockSnapshot(snapshotId) {
    const result = await SupabaseManager.restoreStockSnapshot(snapshotId);
    if (result) await this.refreshSecureStockState();
    return result;
  },
  async reviewStockApproval(approvalId, decision) {
    const result = await SupabaseManager.reviewStockApproval(approvalId, decision);
    if (result) await this.refreshStockProData();
    return result;
  },
  async executeApprovedStockApproval(approval) {
    const action = approval?.action;
    if (!action?.productId || !Number.isFinite(Number(action.newQty))) return false;
    const result = await SupabaseManager.recordStockMovement(
      action.productId,
      Number(action.newQty),
      { ...action, approvalId: approval.id }
    );
    if (result?.status === 'saved') {
      await this.refreshSecureStockState();
      return result;
    }
    return false;
  },
  async transferStockLocation(productId, fromLocation, toLocation, quantity) {
    const result = await SupabaseManager.transferStockLocation(productId, fromLocation, toLocation, quantity);
    if (result) await this.refreshSecureStockState();
    return result;
  },
  async commitStockAudit(audit) {
    const result = await SupabaseManager.commitStockAudit(audit);
    if (result) await this.refreshSecureStockState();
    return result;
  },
  async undoStockMovement(logId) {
    const result = await SupabaseManager.undoStockMovement(logId);
    if (result) await this.refreshSecureStockState();
    return result;
  },
  async resetAllStock() {
    const connected = await this.ensureSupabaseConnection();
    if (!connected || !SupabaseManager.hasSecureSession?.('stock')) return false;

    const result = await SupabaseManager.resetAllStock();
    if (!result) return false;

    const remoteData = await SupabaseManager.fetchAllData();
    if (remoteData === null) return false;
    ['products', 'stock_logs'].forEach(key => {
      if (Object.prototype.hasOwnProperty.call(remoteData, key)) {
        applyCloudRecord(key, remoteData[key]);
      }
    });
    await this.refreshStockProData();
    return result;
  },
  clearStockLogs() {
    localStorage.removeItem(STORAGE_KEYS.STOCK_LOGS);
    this.saveStockLogs([]);
  },

  // Admin-controlled stock receipt recipients
  getStockNotificationSettings() {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.STOCK_NOTIFICATION_SETTINGS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.recipients)) return parsed;
      }
    } catch (error) {
      console.error('Error reading stock notification settings:', error);
    }
    return { recipients: [], updatedAt: null };
  },
  async saveStockNotificationSettings(settings) {
    const payload = {
      recipients: Array.isArray(settings?.recipients) ? [...settings.recipients] : [],
      updatedAt: new Date().toISOString()
    };
    const saved = await this.pushToCloud('stock_notification_settings', payload);
    if (!saved) return false;
    localStorage.setItem(STORAGE_KEYS.STOCK_NOTIFICATION_SETTINGS, JSON.stringify(payload));
    window.dispatchEvent(new CustomEvent('joulane:stockNotificationSettingsUpdated', { detail: payload }));
    return true;
  },
  getStockReceiptDeliveries() {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.STOCK_RECEIPT_DELIVERIES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (error) {
      console.error('Error reading stock receipt deliveries:', error);
    }
    return [];
  },
  async markStockReceiptDelivery(delivery) {
    const connected = await this.ensureSupabaseConnection();
    if (!connected || !SupabaseManager.hasSecureSession('stock')) return false;
    const currentUser = (() => {
      try {
        return JSON.parse(sessionStorage.getItem('joulane_current_stock_user') || 'null');
      } catch (error) {
        return null;
      }
    })();
    const event = {
      ...delivery,
      id: 'delivery_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      timestamp: new Date().toISOString(),
      status: 'share_opened',
      operatorId: currentUser?.id || '',
      operator: currentUser?.name || 'مسؤول المخزن'
    };
    const saved = await SupabaseManager.markStockReceiptDelivery(event);
    if (!saved) return false;
    const previous = this.getStockReceiptDeliveries().filter(item => !(
      item.receiptReference === event.receiptReference && item.recipientPhone === event.recipientPhone
    ));
    const updated = [event, ...previous].slice(0, 1000);
    localStorage.setItem(STORAGE_KEYS.STOCK_RECEIPT_DELIVERIES, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('joulane:stockReceiptDeliveriesUpdated', { detail: updated }));
    return true;
  },

  // User Accounts & Permissions Management
  getUsers() {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.USERS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Error reading users:', e);
    }
    const superAdmin = {
      id: 'usr_super_admin',
      name: 'المدير العام',
      role: 'Super Admin',
      passcode: '',
      allowAdmin: true,
      allowStock: true,
      permissions: {
        stockAdd: true,
        stockRemove: true,
        stockSet: true,
        stockViewLogs: true,
        stockClearLogs: true,
        adminOverview: true,
        adminOrders: true,
        adminPrices: true,
        adminProducts: true,
        adminContent: true,
        adminShipping: true,
        adminUsers: true,
        adminSettings: true
      }
    };
    return [superAdmin];
  },
  saveUsers(users) {
    const safeUsers = users.map(user => ({ ...user, passcode: '' }));
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(safeUsers));
    this._lastUserSync = this.pushToCloud('users', users);
    window.dispatchEvent(new CustomEvent('joulane:usersUpdated', { detail: safeUsers }));
    return this._lastUserSync;
  },
  waitForUserSync() {
    return this._lastUserSync || Promise.resolve(true);
  },
  addUser(user) {
    const users = this.getUsers();
    const newUser = {
      id: 'usr_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      name: user.name || 'مسؤول جديد',
      role: user.role || 'مسؤول',
      passcode: (user.passcode || '').trim(),
      allowAdmin: !!user.allowAdmin,
      allowStock: !!user.allowStock,
      permissions: user.permissions || {
        stockAdd: true,
        stockRemove: true,
        stockSet: false,
        stockViewLogs: true,
        stockClearLogs: false,
        adminOverview: false,
        adminOrders: false,
        adminPrices: false,
        adminProducts: false,
        adminContent: false,
        adminShipping: false,
        adminUsers: false,
        adminSettings: false
      }
    };
    users.push(newUser);
    this.saveUsers(users);
    return users;
  },
  updateUser(id, updatedFields) {
    const users = this.getUsers();
    const index = users.findIndex(u => u.id === id);
    if (index !== -1) {
      users[index] = { ...users[index], ...updatedFields };
      this.saveUsers(users);
    }
    return users;
  },
  deleteUser(id) {
    let users = this.getUsers();
    users = users.filter(u => u.id !== id);
    this.saveUsers(users);
    return users;
  },
  hasSecureSession(surface) {
    return SupabaseManager.hasSecureSession(surface);
  },
  restrictProtectedData(user, surface) {
    const isSuperAdmin = user?.id === 'usr_super_admin';
    const permissions = user?.permissions || {};
    if (surface !== 'admin' || (!isSuperAdmin && permissions.adminOrders !== true)) {
      localStorage.removeItem(STORAGE_KEYS.ORDERS);
    }
    if (surface !== 'stock' || (!isSuperAdmin && permissions.stockViewLogs === false)) {
      localStorage.removeItem(STORAGE_KEYS.STOCK_LOGS);
    }
    if (surface !== 'stock' && !(surface === 'admin' && isSuperAdmin)) {
      localStorage.removeItem(STORAGE_KEYS.STOCK_NOTIFICATION_SETTINGS);
      localStorage.removeItem(STORAGE_KEYS.STOCK_RECEIPT_DELIVERIES);
      localStorage.removeItem(STORAGE_KEYS.STOCK_LOCATIONS);
      localStorage.removeItem(STORAGE_KEYS.STOCK_PRO_SETTINGS);
      localStorage.removeItem(STORAGE_KEYS.STOCK_SNAPSHOTS);
      localStorage.removeItem(STORAGE_KEYS.STOCK_AUDITS);
      localStorage.removeItem(STORAGE_KEYS.STOCK_APPROVALS);
    }
  },
  logoutUser() {
    SupabaseManager.clearSecureSession();
    localStorage.removeItem(STORAGE_KEYS.ORDERS);
    localStorage.removeItem(STORAGE_KEYS.STOCK_LOGS);
    localStorage.removeItem(STORAGE_KEYS.STOCK_NOTIFICATION_SETTINGS);
    localStorage.removeItem(STORAGE_KEYS.STOCK_RECEIPT_DELIVERIES);
    localStorage.removeItem(STORAGE_KEYS.STOCK_LOCATIONS);
    localStorage.removeItem(STORAGE_KEYS.STOCK_PRO_SETTINGS);
    localStorage.removeItem(STORAGE_KEYS.STOCK_SNAPSHOTS);
    localStorage.removeItem(STORAGE_KEYS.STOCK_AUDITS);
    localStorage.removeItem(STORAGE_KEYS.STOCK_APPROVALS);
  },
  async authenticateUser(usernameOrId, passcode, surface) {
    const passTrimmed = (passcode || '').trim();
    const userTrimmed = (usernameOrId || '').trim();

    if (!passTrimmed) return null;

    const definitelyOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
    if (!definitelyOffline) {
      const connected = await this.ensureSupabaseConnection();
      if (connected) {
        const secureUser = await SupabaseManager.login(userTrimmed || 'all', passTrimmed, surface);
        if (secureUser) {
          await this.cacheOfflineCredential(secureUser, passTrimmed, surface);
          return secureUser;
        }
        if (secureUser === null) return null;
      }
    }
    return this.authenticateOfflineUser(userTrimmed, passTrimmed, surface);
  },
  async cacheOfflineCredential(user, passcode, surface) {
    if (!globalThis.crypto?.subtle || !user?.id || !passcode) return false;
    try {
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey('raw', encoder.encode(passcode), 'PBKDF2', false, ['deriveBits']);
      const bits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 150000 },
        key,
        256
      );
      const credentials = JSON.parse(localStorage.getItem(STORAGE_KEYS.OFFLINE_CREDENTIALS) || '{}');
      credentials[`${surface}:${user.id}`] = {
        salt: bytesToBase64(salt),
        hash: bytesToBase64(new Uint8Array(bits)),
        user,
        cachedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 86400000).toISOString()
      };
      localStorage.setItem(STORAGE_KEYS.OFFLINE_CREDENTIALS, JSON.stringify(credentials));
      return true;
    } catch (error) {
      console.warn('Could not cache offline credential:', error);
      return false;
    }
  },
  async authenticateOfflineUser(userId, passcode, surface) {
    if (!globalThis.crypto?.subtle || !userId || userId === 'all') return null;
    try {
      const credentials = JSON.parse(localStorage.getItem(STORAGE_KEYS.OFFLINE_CREDENTIALS) || '{}');
      const credential = credentials[`${surface}:${userId}`];
      if (!credential || new Date(credential.expiresAt).getTime() < Date.now()) return null;
      const salt = base64ToBytes(credential.salt);
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey('raw', encoder.encode(passcode), 'PBKDF2', false, ['deriveBits']);
      const bits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 150000 },
        key,
        256
      );
      const actual = new Uint8Array(bits);
      const expected = base64ToBytes(credential.hash);
      if (actual.length !== expected.length) return null;
      let difference = 0;
      actual.forEach((value, index) => { difference |= value ^ expected[index]; });
      return difference === 0 ? { ...credential.user, offlineSession: true } : null;
    } catch (error) {
      console.warn('Offline authentication failed:', error);
      return null;
    }
  },

  // Export / Import / Reset
  exportAllData() {
    return {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      config: this.getConfig(),
      categories: this.getCategories(),
      products: this.getProducts(),
      orders: this.getOrders(),
      shipping: this.getShippingRates()
    };
  },
  importAllData(data) {
    if (!data) return false;
    if (data.config) this.saveConfig(data.config);
    if (data.categories && Array.isArray(data.categories)) this.saveCategories(data.categories);
    if (data.products && Array.isArray(data.products)) this.saveProducts(data.products);
    if (data.orders && Array.isArray(data.orders)) this.saveOrders(data.orders);
    if (data.shipping) this.saveShippingRates(data.shipping);
    return true;
  },
  resetToDefaults() {
    localStorage.removeItem(STORAGE_KEYS.CONFIG);
    localStorage.removeItem(STORAGE_KEYS.PRODUCTS);
    localStorage.removeItem(STORAGE_KEYS.SHIPPING);
    localStorage.removeItem(STORAGE_KEYS.PASSCODE);
    localStorage.removeItem(STORAGE_KEYS.CART);
    localStorage.removeItem(STORAGE_KEYS.CATEGORIES);
    localStorage.removeItem(STORAGE_KEYS.PENDING_SYNC);
    this.saveProducts(PRODUCTS);
    this.saveConfig(DEFAULT_CONFIG);
  }
};

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void (async () => {
      const connected = await Store.ensureSupabaseConnection();
      if (connected) await Store.flushPendingSync();
    })();
  });
}
