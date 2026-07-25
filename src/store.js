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
  USERS: 'joulane_users'
};

const PRODUCT_CATALOG_VERSION = '2026-07-25-70-models-full-sync-v2';

export const Store = {
  // Supabase Integration
  async initSupabase(refreshFn) {
    const config = this.getConfig();
    if (!config.supabaseUrl || !config.supabaseAnonKey) return false;

    const client = SupabaseManager.init(config.supabaseUrl, config.supabaseAnonKey, (key, data) => {
      // Realtime update handler when data changes in Supabase
      if (key === 'config') {
        localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(data));
        window.dispatchEvent(new CustomEvent('joulane:configUpdated', { detail: data }));
      } else if (key === 'products') {
        localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(data));
        window.dispatchEvent(new CustomEvent('joulane:productsUpdated', { detail: data }));
      } else if (key === 'categories') {
        localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(data));
        window.dispatchEvent(new CustomEvent('joulane:categoriesUpdated', { detail: data }));
      } else if (key === 'orders') {
        localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(data));
        window.dispatchEvent(new CustomEvent('joulane:ordersUpdated', { detail: data }));
      } else if (key === 'shipping') {
        localStorage.setItem(STORAGE_KEYS.SHIPPING, JSON.stringify(data));
        window.dispatchEvent(new CustomEvent('joulane:shippingUpdated', { detail: data }));
      }
      if (refreshFn) refreshFn();
      window.dispatchEvent(new CustomEvent('joulane:refreshStore'));
    });

    if (client) {
      // Initial fetch of remote state
      const remoteData = await SupabaseManager.fetchAllData();
      if (remoteData) {
        if (remoteData.config) localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(remoteData.config));
        if (remoteData.products) localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(remoteData.products));
        if (remoteData.categories) localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(remoteData.categories));
        if (remoteData.orders) localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(remoteData.orders));
        if (remoteData.shipping) localStorage.setItem(STORAGE_KEYS.SHIPPING, JSON.stringify(remoteData.shipping));
        if (refreshFn) refreshFn();
        window.dispatchEvent(new CustomEvent('joulane:refreshStore'));
      }
    }
    return !!client;
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
  saveConfig(config) {
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(config));
    SupabaseManager.pushData('config', config);
    window.dispatchEvent(new CustomEvent('joulane:configUpdated', { detail: config }));
  },

  // Passcode
  getPasscode() {
    return localStorage.getItem(STORAGE_KEYS.PASSCODE) || this.getConfig().adminPasscode || '1234';
  },
  setPasscode(newPass) {
    localStorage.setItem(STORAGE_KEYS.PASSCODE, newPass);
    const config = this.getConfig();
    config.adminPasscode = newPass;
    this.saveConfig(config);
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
    SupabaseManager.pushData('categories', categories);
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
    SupabaseManager.pushData('products', products);
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
    SupabaseManager.pushData('orders', orders);
    window.dispatchEvent(new CustomEvent('joulane:ordersUpdated', { detail: orders }));
  },
  addOrder(order) {
    const orders = this.getOrders();
    orders.unshift(order);
    this.saveOrders(orders);
    return orders;
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
    SupabaseManager.pushData('shipping', ratesMap);
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
    SupabaseManager.pushData('stock_logs', logs);
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
  clearStockLogs() {
    localStorage.removeItem(STORAGE_KEYS.STOCK_LOGS);
    this.saveStockLogs([]);
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
      passcode: this.getPasscode() || '1234',
      allowAdmin: true,
      allowStock: true,
      permissions: {
        stockAdd: true,
        stockRemove: true,
        stockSet: true,
        stockClearLogs: true,
        adminOrders: true,
        adminPrices: true,
        adminProducts: true,
        adminUsers: true
      }
    };
    return [superAdmin];
  },
  saveUsers(users) {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    SupabaseManager.pushData('users', users);
    window.dispatchEvent(new CustomEvent('joulane:usersUpdated', { detail: users }));
  },
  addUser(user) {
    const users = this.getUsers();
    const newUser = {
      id: 'usr_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      name: user.name || 'مسؤول جديد',
      role: user.role || 'مسؤول',
      passcode: user.passcode || '1234',
      allowAdmin: !!user.allowAdmin,
      allowStock: !!user.allowStock,
      permissions: user.permissions || {
        stockAdd: true,
        stockRemove: true,
        stockSet: false,
        stockClearLogs: false,
        adminOrders: false,
        adminPrices: false,
        adminProducts: false,
        adminUsers: false
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
  authenticateUser(usernameOrId, passcode) {
    const users = this.getUsers();
    const globalPass = this.getPasscode();
    const passTrimmed = (passcode || '').trim();
    const userTrimmed = (usernameOrId || '').trim();

    if (!passTrimmed) return null;

    // If username is provided, match both username/id AND passcode
    if (userTrimmed && userTrimmed !== 'all') {
      const matched = users.find(u =>
        (u.id === userTrimmed || u.name.toLowerCase() === userTrimmed.toLowerCase()) &&
        (u.passcode || '').trim() === passTrimmed
      );
      if (matched) return matched;
      
      // Check if super admin login via username
      if ((userTrimmed === 'usr_super_admin' || userTrimmed === 'المدير العام') && (passTrimmed === globalPass || passTrimmed === '1234')) {
        return users.find(u => u.id === 'usr_super_admin') || {
          id: 'usr_super_admin',
          name: 'المدير العام',
          role: 'Super Admin',
          passcode: globalPass,
          allowAdmin: true,
          allowStock: true,
          permissions: { stockAdd: true, stockRemove: true, stockSet: true, stockClearLogs: true, adminOrders: true, adminPrices: true, adminProducts: true, adminUsers: true }
        };
      }
      return null;
    }

    // If no username specified or 'all', try matching by passcode alone
    const matchedByPass = users.find(u => (u.passcode || '').trim() === passTrimmed);
    if (matchedByPass) return matchedByPass;

    if (passTrimmed === globalPass || passTrimmed === '1234') {
      return users.find(u => u.id === 'usr_super_admin') || {
        id: 'usr_super_admin',
        name: 'المدير العام',
        role: 'Super Admin',
        passcode: globalPass,
        allowAdmin: true,
        allowStock: true,
        permissions: {
          stockAdd: true,
          stockRemove: true,
          stockSet: true,
          stockClearLogs: true,
          adminOrders: true,
          adminPrices: true,
          adminProducts: true,
          adminUsers: true
        }
      };
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
    this.saveProducts(PRODUCTS);
    this.saveConfig(DEFAULT_CONFIG);
  }
};
