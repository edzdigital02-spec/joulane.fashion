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
  USERS: 'joulane_users',
  PENDING_SYNC: 'joulane_pending_sync'
};

const PRODUCT_CATALOG_VERSION = '2026-07-25-70-models-full-sync-v2';

const CLOUD_RECORDS = {
  config: { storageKey: STORAGE_KEYS.CONFIG, eventName: 'joulane:configUpdated' },
  products: { storageKey: STORAGE_KEYS.PRODUCTS, eventName: 'joulane:productsUpdated' },
  categories: { storageKey: STORAGE_KEYS.CATEGORIES, eventName: 'joulane:categoriesUpdated' },
  orders: { storageKey: STORAGE_KEYS.ORDERS, eventName: 'joulane:ordersUpdated' },
  shipping: { storageKey: STORAGE_KEYS.SHIPPING, eventName: 'joulane:shippingUpdated' },
  stock_logs: { storageKey: STORAGE_KEYS.STOCK_LOGS, eventName: 'joulane:stockLogsUpdated' },
  stock_notification_settings: { storageKey: STORAGE_KEYS.STOCK_NOTIFICATION_SETTINGS, eventName: 'joulane:stockNotificationSettingsUpdated' },
  stock_receipt_deliveries: { storageKey: STORAGE_KEYS.STOCK_RECEIPT_DELIVERIES, eventName: 'joulane:stockReceiptDeliveriesUpdated' },
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

function applyCloudRecord(key, data, dispatchEvent = true) {
  const record = CLOUD_RECORDS[key];
  if (!record || data === undefined || data === null) return false;

  let value = data;
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
  if (dispatchEvent) {
    window.dispatchEvent(new CustomEvent(record.eventName, { detail: value }));
  }
  return true;
}

export const Store = {
  _cloudHydrated: false,
  _initializingCloud: null,

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

      // Migrate existing browser/app data to the cloud only when a cloud row is absent.
      for (const [key, record] of Object.entries(CLOUD_RECORDS)) {
        if (Object.prototype.hasOwnProperty.call(remoteData, key)) continue;
        if (['stock_notification_settings', 'stock_receipt_deliveries'].includes(key)) continue;
        if (['orders', 'stock_logs', 'users', 'stock_notification_settings', 'stock_receipt_deliveries'].includes(key) && !SupabaseManager.hasSecureSession()) continue;
        const localValue = localStorage.getItem(record.storageKey);
        if (!localValue) continue;

        try {
          const parsed = JSON.parse(localValue);
          const payload = key === 'config' ? configForCloud(parsed) : parsed;
          const migrated = await SupabaseManager.pushData(key, payload);
          if (!migrated) this.queuePendingSync(key, payload);
        } catch (e) {
          console.warn(`Could not migrate local ${key} data to Supabase:`, e);
        }
      }

      this._cloudHydrated = true;
      await this.flushPendingSync();

      if (refreshFn) refreshFn();
      window.dispatchEvent(new CustomEvent('joulane:refreshStore'));
      window.dispatchEvent(new CustomEvent('joulane:syncStatus', {
        detail: { connected: true, message: 'تمت مزامنة البيانات مع Supabase.' }
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

  async pushToCloud(key, data) {
    const payload = key === 'config' ? configForCloud(data) : data;
    const connected = await this.ensureSupabaseConnection();
    if (!connected) {
      this.queuePendingSync(key, payload);
      return false;
    }

    const ok = await SupabaseManager.pushData(key, payload);
    if (!ok) this.queuePendingSync(key, payload);
    return ok;
  },

  async flushPendingSync() {
    let pending = {};
    try {
      pending = JSON.parse(localStorage.getItem(STORAGE_KEYS.PENDING_SYNC) || '{}');
    } catch (e) {
      console.warn('Could not parse pending sync queue:', e);
      return false;
    }

    const entries = Object.entries(pending);
    if (!entries.length) return true;

    for (const [key, item] of entries) {
      const ok = key.startsWith('order:')
        ? await SupabaseManager.submitOrder(item.data)
        : await SupabaseManager.pushData(key, item.data);
      if (ok) {
        if (!key.startsWith('order:')) applyCloudRecord(key, item.data, false);
        delete pending[key];
      }
    }

    localStorage.setItem(STORAGE_KEYS.PENDING_SYNC, JSON.stringify(pending));
    return Object.keys(pending).length === 0;
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
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Error reading products:', e);
    }
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(PRODUCTS));
    return PRODUCTS;
  },
  saveProducts(products) {
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
    localStorage.setItem(STORAGE_KEYS.PRODUCTS_VERSION, PRODUCT_CATALOG_VERSION);
    this.pushToCloud('products', products);
    window.dispatchEvent(new CustomEvent('joulane:productsUpdated', { detail: products }));
  },
  addProduct(newProduct) {
    const products = this.getProducts();
    products.unshift(newProduct);
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
  addToCart(product, color, seriesQty = 1) {
    const cart = this.getCart();
    const existingIndex = cart.findIndex(item => item.productId === product.id && item.color === color);
    
    if (existingIndex !== -1) {
      cart[existingIndex].seriesQty += seriesQty;
      cart[existingIndex].totalPrice = cart[existingIndex].seriesQty * cart[existingIndex].seriesPrice;
    } else {
      cart.push({
        productId: product.id,
        nameAr: product.name?.ar || product.name || 'منتج',
        nameFr: product.name?.fr || product.name || 'Produit',
        image: product.image || '/images/303-3.PNG',
        color: color || 'افتراضي',
        seriesQty: seriesQty,
        pairsPerSeries: product.pairsPerSeries || 6,
        seriesPrice: product.seriesPrice || 0,
        totalPrice: seriesQty * (product.seriesPrice || 0)
      });
    }
    
    this.saveCart(cart);
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
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Error reading orders:', e);
    }
    return [];
  },
  saveOrders(orders) {
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
    this.pushToCloud('orders', orders);
    window.dispatchEvent(new CustomEvent('joulane:ordersUpdated', { detail: orders }));
  },
  async submitOrder(order) {
    const connected = await this.ensureSupabaseConnection();
    if (!connected) {
      this.queuePendingSync(`order:${order.id}`, order);
      return false;
    }
    const ok = await SupabaseManager.submitOrder(order);
    if (!ok) this.queuePendingSync(`order:${order.id}`, order);
    return ok;
  },
  async addOrder(order) {
    const orders = this.getOrders();
    orders.unshift(order);
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
    window.dispatchEvent(new CustomEvent('joulane:ordersUpdated', { detail: orders }));
    return this.submitOrder(order);
  },
  updateOrderStatus(orderId, newStatus) {
    const orders = this.getOrders();
    const order = orders.find(o => o.id === orderId);
    if (order) {
      order.status = newStatus;
      this.saveOrders(orders);
    }
    return orders;
  },
  deleteOrder(orderId) {
    let orders = this.getOrders();
    orders = orders.filter(o => o.id !== orderId);
    this.saveOrders(orders);
    return orders;
  },
  clearOrders() {
    localStorage.removeItem(STORAGE_KEYS.ORDERS);
    localStorage.removeItem('youlan_orders');
    this.saveOrders([]);
  },

  // Shipping Rates
  getShippingRates() {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SHIPPING);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Error reading shipping rates:', e);
    }
    const defaultRates = {};
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
    const connected = await this.ensureSupabaseConnection();
    if (!connected || !SupabaseManager.hasSecureSession?.('stock')) return false;

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

    const atomicResult = await SupabaseManager.recordStockMovement(productId, productUpdates.seriesQty, newLog);
    if (atomicResult === false) return false;

    if (atomicResult === null) {
      const productSaved = await SupabaseManager.pushData('products', productsAfter);
      if (!productSaved) return false;
      const logSaved = await SupabaseManager.pushData('stock_logs', [newLog, ...logsBefore]);
      if (!logSaved) {
        await SupabaseManager.pushData('products', productsBefore);
        return false;
      }
    }

    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(productsAfter));
    localStorage.setItem(STORAGE_KEYS.PRODUCTS_VERSION, PRODUCT_CATALOG_VERSION);
    localStorage.setItem(STORAGE_KEYS.STOCK_LOGS, JSON.stringify([newLog, ...logsBefore]));
    window.dispatchEvent(new CustomEvent('joulane:productsUpdated', { detail: productsAfter }));
    window.dispatchEvent(new CustomEvent('joulane:stockLogsUpdated', { detail: [newLog, ...logsBefore] }));
    return newLog;
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
      recipients: Array.isArray(settings?.recipients) ? settings.recipients.slice(0, 4) : [],
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
    }
  },
  logoutUser() {
    SupabaseManager.clearSecureSession();
    localStorage.removeItem(STORAGE_KEYS.ORDERS);
    localStorage.removeItem(STORAGE_KEYS.STOCK_LOGS);
    localStorage.removeItem(STORAGE_KEYS.STOCK_NOTIFICATION_SETTINGS);
    localStorage.removeItem(STORAGE_KEYS.STOCK_RECEIPT_DELIVERIES);
  },
  async authenticateUser(usernameOrId, passcode, surface) {
    const passTrimmed = (passcode || '').trim();
    const userTrimmed = (usernameOrId || '').trim();

    if (!passTrimmed) return null;

    const connected = await this.ensureSupabaseConnection();
    if (connected) {
      const secureUser = await SupabaseManager.login(userTrimmed || 'all', passTrimmed, surface);
      return secureUser || null;
    }
    return null;
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
