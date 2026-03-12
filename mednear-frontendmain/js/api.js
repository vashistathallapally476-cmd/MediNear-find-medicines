/* ============================================================
   MedNear — API Base Configuration
   Handles all HTTP communication with Spring Boot backend
   ============================================================ */

const API = (() => {
  // ── Config ────────────────────────────────────────────────
  const BASE_URL = 'http://localhost:8080/api';
  const TOKEN_KEY = 'mednear_token';
  const USER_KEY  = 'mednear_user';

  // ── Token Helpers ─────────────────────────────────────────
  const getToken = () => localStorage.getItem(TOKEN_KEY);
  const setToken = (t) => localStorage.setItem(TOKEN_KEY, t);
  const removeToken = () => localStorage.removeItem(TOKEN_KEY);

  const getUser = () => {
    try { return JSON.parse(localStorage.getItem(USER_KEY)); }
    catch { return null; }
  };
  const setUser = (u) => localStorage.setItem(USER_KEY, JSON.stringify(u));
  const removeUser = () => localStorage.removeItem(USER_KEY);

  const isLoggedIn = () => !!getToken();

  const logout = () => {
    removeToken();
    removeUser();
    window.location.href = 'login.html';
  };

  // ── Request Builder ───────────────────────────────────────
  const request = async (method, path, body = null, auth = false) => {
    const headers = { 'Content-Type': 'application/json' };
    if (auth) {
      const token = getToken();
      if (!token) { window.location.href = 'login.html'; return; }
      headers['Authorization'] = `Bearer ${token}`;
    }

    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    try {
      const res = await fetch(`${BASE_URL}${path}`, options);
      const data = await res.json().catch(() => ({}));

      if (res.status === 401) { logout(); return; }
      if (!res.ok) throw { status: res.status, message: data.message || 'Request failed', data };

      return data;
    } catch (err) {
      if (err.status) throw err;
      throw { status: 0, message: 'Network error. Please check your connection.', data: {} };
    }
  };

  // ── Auth Endpoints ────────────────────────────────────────
  const auth = {
    register: (payload) => request('POST', '/auth/register', payload),
    login:    (payload) => request('POST', '/auth/login', payload),
    me:       ()        => request('GET',  '/auth/me', null, true),
  };

  // ── Medicine Search Endpoints ─────────────────────────────
  const medicines = {
    search: (query, lat, lng, radius = 5000) =>
      request('GET', `/medicines/search?q=${encodeURIComponent(query)}&lat=${lat}&lng=${lng}&radius=${radius}`),
    getById: (id) => request('GET', `/medicines/${id}`),
    getCategories: () => request('GET', '/medicines/categories'),
  };

  // ── Store Endpoints ───────────────────────────────────────
  const stores = {
    register: (payload) => request('POST', '/stores', payload, true),
    getMyStore: () => request('GET', '/stores/me', null, true),
    updateStore: (id, payload) => request('PUT', `/stores/${id}`, payload, true),
    nearby: (lat, lng, radius = 5000) =>
      request('GET', `/stores/nearby?lat=${lat}&lng=${lng}&radius=${radius}`),
  };

  // ── Inventory Endpoints ───────────────────────────────────
  const inventory = {
    getAll:  ()              => request('GET',    '/inventory',     null,    true),
    add:     (payload)       => request('POST',   '/inventory',     payload, true),
    update:  (id, payload)   => request('PUT',    `/inventory/${id}`, payload, true),
    remove:  (id)            => request('DELETE', `/inventory/${id}`, null,   true),
    getByStore: (storeId)    => request('GET',    `/inventory/store/${storeId}`),
  };

  // ── Public API ────────────────────────────────────────────
  return {
    BASE_URL,
    getToken, setToken, removeToken,
    getUser,  setUser,  removeUser,
    isLoggedIn, logout,
    auth, medicines, stores, inventory,
  };
})();

// ── Toast Helper ──────────────────────────────────────────────
function showToast(message, type = 'success', duration = 3500) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const icons = { success: '✓', error: '✕', warning: '⚠' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.success}</span>
    <span class="toast-msg">${message}</span>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('hide');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ── Loading Button Helper ──────────────────────────────────────
function setButtonLoading(btn, loading, originalText) {
  if (loading) {
    btn.disabled = true;
    btn.dataset.originalText = btn.innerHTML;
    btn.innerHTML = `<span class="spinner"></span> ${originalText || 'Loading...'}`;
  } else {
    btn.disabled = false;
    btn.innerHTML = btn.dataset.originalText || originalText;
  }
}

// ── Format Helpers ────────────────────────────────────────────
function formatDistance(meters) {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

function formatTime(time24) {
  if (!time24) return 'N/A';
  const [h, m] = time24.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2,'0')} ${ampm}`;
}
