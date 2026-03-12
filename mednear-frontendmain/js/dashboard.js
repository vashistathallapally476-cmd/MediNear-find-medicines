/* ============================================================
   MedNear — dashboard.js
   Owner Dashboard: Store Registration + Inventory Management
   ============================================================ */

// ── State ─────────────────────────────────────────────────────
const DashState = {
  store: null,
  inventory: [],
  editingMedId: null,
  currentTab: 'overview',
};

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  requireAuth();
  populateUserInfo();
  initTabs();
  initSidebar();
  loadDashboard();
});

function requireAuth() {
  if (!API.isLoggedIn()) window.location.href = 'login.html';
}

function populateUserInfo() {
  const user = API.getUser();
  if (!user) return;
  const nameEls = document.querySelectorAll('.user-name');
  const emailEls = document.querySelectorAll('.user-email');
  nameEls.forEach(el => el.textContent = user.name || user.email?.split('@')[0] || 'Owner');
  emailEls.forEach(el => el.textContent = user.email || '');

  const avatarEls = document.querySelectorAll('.user-avatar');
  const initials = (user.name || user.email || 'O').charAt(0).toUpperCase();
  avatarEls.forEach(el => { if (el.tagName !== 'IMG') el.textContent = initials; });
}

// ── Tabs ──────────────────────────────────────────────────────
function initTabs() {
  const tabBtns = document.querySelectorAll('[data-tab]');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      switchTab(btn.dataset.tab);
    });
  });
}

function switchTab(tabName) {
  DashState.currentTab = tabName;
  document.querySelectorAll('[data-tab]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === `tab-${tabName}`);
  });
}

// ── Sidebar ───────────────────────────────────────────────────
function initSidebar() {
  const toggle = document.getElementById('sidebar-toggle');
  const sidebar = document.getElementById('sidebar');
  if (toggle && sidebar) {
    toggle.addEventListener('click', () => sidebar.classList.toggle('open'));
  }

  document.querySelectorAll('.sidebar-link').forEach(link => {
    link.addEventListener('click', (e) => {
      const tab = link.dataset.tab;
      if (tab) {
        e.preventDefault();
        document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        switchTab(tab);
        if (window.innerWidth <= 768) sidebar.classList.remove('open');
      }
    });
  });

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', API.logout);
}

// ── Load Dashboard ────────────────────────────────────────────
async function loadDashboard() {
  showTabLoader(true);
  try {
    const storeData = await API.stores.getMyStore().catch(() => null);
    DashState.store = storeData;

    if (!storeData) {
      showStoreRegistration();
    } else {
      showFullDashboard();
      await loadInventory();
      updateStats();
    }
  } catch {
    DashState.store = null;
    showStoreRegistration();
  }
  showTabLoader(false);
}

function showStoreRegistration() {
  const noStore  = document.getElementById('no-store-section');
  const mainDash = document.getElementById('main-dashboard');
  if (noStore)  noStore.classList.remove('hidden');
  if (mainDash) mainDash.classList.add('hidden');
}

function showFullDashboard() {
  const noStore  = document.getElementById('no-store-section');
  const mainDash = document.getElementById('main-dashboard');
  if (noStore)  noStore.classList.add('hidden');
  if (mainDash) mainDash.classList.remove('hidden');
  renderStoreInfo();
}

function showTabLoader(show) {
  const loader = document.getElementById('tab-loader');
  if (loader) loader.classList.toggle('hidden', !show);
}

// ── Store Info ────────────────────────────────────────────────
function renderStoreInfo() {
  const s = DashState.store;
  if (!s) return;

  const fields = {
    'store-name-display':    s.name,
    'store-address-display': s.address,
    'store-phone-display':   s.phone,
    'store-license-display': s.licenseNumber,
    'store-hours-display':   s.openTime && s.closeTime ? `${formatTime(s.openTime)} – ${formatTime(s.closeTime)}` : '—',
  };
  Object.entries(fields).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val || '—';
  });

  const statusBadge = document.getElementById('store-status-badge');
  if (statusBadge) {
    statusBadge.className = `badge badge-${s.verified ? 'green' : 'warn'}`;
    statusBadge.textContent = s.verified ? '✓ Verified' : '⏳ Pending Verification';
  }
}

// ── Store Registration Form ───────────────────────────────────
function initStoreRegForm() {
  const form = document.getElementById('store-reg-form');
  if (!form) return;

  // Map click for location
  const mapBtn = document.getElementById('pick-location-btn');
  if (mapBtn) {
    mapBtn.addEventListener('click', () => {
      if (navigator.geolocation) {
        mapBtn.innerHTML = '<span class="spinner"></span> Detecting...';
        navigator.geolocation.getCurrentPosition(pos => {
          document.getElementById('store-lat').value = pos.coords.latitude.toFixed(6);
          document.getElementById('store-lng').value = pos.coords.longitude.toFixed(6);
          mapBtn.innerHTML = '📍 Location Set';
          mapBtn.classList.add('btn-primary');
          showToast('Location detected!', 'success');
        }, () => {
          mapBtn.innerHTML = '📍 Detect Location';
          showToast('Could not detect location.', 'error');
        });
      }
    });
  }

  form.addEventListener('submit', handleStoreRegistration);
}

async function handleStoreRegistration(e) {
  e.preventDefault();
  const btn = document.getElementById('store-reg-btn');
  setButtonLoading(btn, true, 'Registering...');

  const payload = {
    name:          document.getElementById('store-name')?.value.trim(),
    address:       document.getElementById('store-address')?.value.trim(),
    phone:         document.getElementById('store-reg-phone')?.value.trim(),
    licenseNumber: document.getElementById('store-license')?.value.trim(),
    openTime:      document.getElementById('store-open-time')?.value,
    closeTime:     document.getElementById('store-close-time')?.value,
    lat:           parseFloat(document.getElementById('store-lat')?.value) || 0,
    lng:           parseFloat(document.getElementById('store-lng')?.value) || 0,
    deliveryAvail: document.getElementById('store-delivery')?.checked || false,
    emergency24h:  document.getElementById('store-24h')?.checked || false,
  };

  try {
    const data = await API.stores.register(payload);
    DashState.store = data;
    showToast('Store registered successfully!', 'success');
    showFullDashboard();
    updateStats();
  } catch (err) {
    // Demo fallback
    DashState.store = { ...payload, id: 'demo_store_1', verified: false };
    showToast('Store registered (demo mode)!', 'success');
    showFullDashboard();
    updateStats();
  } finally {
    setButtonLoading(btn, false);
  }
}

// ── Inventory ─────────────────────────────────────────────────
async function loadInventory() {
  const tbody = document.getElementById('inventory-tbody');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted" style="padding:40px">
    <span class="spinner"></span></td></tr>`;

  try {
    const data = await API.inventory.getAll();
    DashState.inventory = data || [];
  } catch {
    DashState.inventory = getDemoInventory();
  }

  renderInventoryTable();
}

function renderInventoryTable(filter = '') {
  const tbody = document.getElementById('inventory-tbody');
  if (!tbody) return;

  let items = DashState.inventory;
  if (filter) items = items.filter(i =>
    i.medicineName.toLowerCase().includes(filter.toLowerCase()) ||
    (i.category || '').toLowerCase().includes(filter.toLowerCase())
  );

  if (!items.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted" style="padding:40px">
      No medicines found. <a href="#" onclick="openMedModal()">Add your first medicine →</a></td></tr>`;
    return;
  }

  tbody.innerHTML = items.map(item => {
    const qtyClass = item.quantity > 50 ? 'text-teal' : item.quantity > 10 ? '' : item.quantity > 0 ? 'text-warn' : 'text-danger';
    const dotClass = item.quantity > 10 ? 'in' : item.quantity > 0 ? 'low' : 'out';
    const expiryDate = item.expiryDate ? new Date(item.expiryDate) : null;
    const expired = expiryDate && expiryDate < new Date();
    return `
    <tr class="animate-fadeIn">
      <td>
        <div style="font-weight:600">${item.medicineName}</div>
        <div class="text-xs text-muted">${item.manufacturer || '—'}</div>
      </td>
      <td>
        <span class="badge badge-teal" style="font-size:0.72rem">${item.category || 'General'}</span>
      </td>
      <td>
        <span class="avail-dot ${dotClass}"></span>
        <span class="${qtyClass} font-bold">${item.quantity}</span>
        <span class="text-xs text-muted"> units</span>
      </td>
      <td class="font-bold">₹${item.price || '—'}</td>
      <td>
        ${expiryDate
          ? `<span class="${expired ? 'text-danger' : 'text-muted'}" style="font-size:0.85rem">
              ${expired ? '⚠ ' : ''}${expiryDate.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}
            </span>`
          : '<span class="text-muted">—</span>'
        }
      </td>
      <td>
        <div class="flex gap-8">
          <button class="btn btn-ghost btn-sm btn-icon" onclick="editMedicine('${item.id}')" title="Edit">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button class="btn btn-sm btn-icon" style="background:rgba(255,77,109,0.1);border:1px solid rgba(255,77,109,0.2);color:var(--danger)"
            onclick="deleteMedicine('${item.id}')" title="Delete">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
          </button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

// ── Inventory Search ──────────────────────────────────────────
function initInventorySearch() {
  const search = document.getElementById('inventory-search');
  if (!search) return;
  search.addEventListener('input', () => renderInventoryTable(search.value));
}

// ── Add / Edit Medicine Modal ─────────────────────────────────
function openMedModal(id = null) {
  DashState.editingMedId = id;
  const modal = document.getElementById('med-modal');
  const title = document.getElementById('med-modal-title');
  const form  = document.getElementById('med-form');

  if (!modal) return;
  if (form) form.reset();
  if (title) title.textContent = id ? 'Edit Medicine' : 'Add Medicine';

  if (id) {
    const item = DashState.inventory.find(i => i.id === id);
    if (item) prefillMedForm(item);
  }
  modal.classList.add('open');
}

function closeMedModal() {
  const modal = document.getElementById('med-modal');
  if (modal) { modal.classList.remove('open'); DashState.editingMedId = null; }
}

function prefillMedForm(item) {
  const fields = {
    'med-name': item.medicineName, 'med-category': item.category,
    'med-qty': item.quantity, 'med-price': item.price,
    'med-manufacturer': item.manufacturer, 'med-expiry': item.expiryDate,
    'med-description': item.description,
  };
  Object.entries(fields).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.value = val || '';
  });
}

async function saveMedicine(e) {
  e.preventDefault();
  const btn = document.getElementById('save-med-btn');
  setButtonLoading(btn, true, 'Saving...');

  const payload = {
    medicineName: document.getElementById('med-name')?.value.trim(),
    category:     document.getElementById('med-category')?.value,
    quantity:     parseInt(document.getElementById('med-qty')?.value) || 0,
    price:        parseFloat(document.getElementById('med-price')?.value) || 0,
    manufacturer: document.getElementById('med-manufacturer')?.value.trim(),
    expiryDate:   document.getElementById('med-expiry')?.value || null,
    description:  document.getElementById('med-description')?.value.trim(),
  };

  if (!payload.medicineName) {
    showToast('Medicine name is required.', 'error');
    setButtonLoading(btn, false);
    return;
  }

  try {
    let result;
    if (DashState.editingMedId) {
      result = await API.inventory.update(DashState.editingMedId, payload);
      const idx = DashState.inventory.findIndex(i => i.id === DashState.editingMedId);
      if (idx !== -1) DashState.inventory[idx] = { ...DashState.inventory[idx], ...payload };
      showToast('Medicine updated!', 'success');
    } else {
      result = await API.inventory.add(payload);
      DashState.inventory.unshift(result || { ...payload, id: 'med_' + Date.now() });
      showToast('Medicine added!', 'success');
    }
  } catch {
    // Demo fallback
    if (DashState.editingMedId) {
      const idx = DashState.inventory.findIndex(i => i.id === DashState.editingMedId);
      if (idx !== -1) DashState.inventory[idx] = { ...DashState.inventory[idx], ...payload };
      showToast('Medicine updated (demo mode)!', 'success');
    } else {
      DashState.inventory.unshift({ ...payload, id: 'med_' + Date.now() });
      showToast('Medicine added (demo mode)!', 'success');
    }
  } finally {
    setButtonLoading(btn, false);
    closeMedModal();
    renderInventoryTable();
    updateStats();
  }
}

function editMedicine(id) { openMedModal(id); }

async function deleteMedicine(id) {
  if (!confirm('Remove this medicine from inventory?')) return;
  try {
    await API.inventory.remove(id);
  } catch { /* demo */ }
  DashState.inventory = DashState.inventory.filter(i => i.id !== id);
  renderInventoryTable();
  updateStats();
  showToast('Medicine removed.', 'success');
}

// ── Stats ─────────────────────────────────────────────────────
function updateStats() {
  const inv = DashState.inventory;
  const total    = inv.length;
  const inStock  = inv.filter(i => i.quantity > 0).length;
  const outStock = inv.filter(i => i.quantity === 0).length;
  const lowStock = inv.filter(i => i.quantity > 0 && i.quantity <= 10).length;
  const now = new Date();
  const expiringSoon = inv.filter(i => {
    if (!i.expiryDate) return false;
    const d = new Date(i.expiryDate);
    const diff = (d - now) / (1000 * 3600 * 24);
    return diff >= 0 && diff <= 30;
  }).length;

  const els = {
    'stat-total':    total,
    'stat-instock':  inStock,
    'stat-outstock': outStock,
    'stat-lowstock': lowStock,
    'stat-expiring': expiringSoon,
  };
  Object.entries(els).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) { el.textContent = val; el.classList.add('count-up'); }
  });
}

// ── Export CSV ────────────────────────────────────────────────
function exportInventoryCSV() {
  const headers = ['Medicine Name','Category','Quantity','Price','Manufacturer','Expiry Date'];
  const rows = DashState.inventory.map(i => [
    i.medicineName, i.category || '', i.quantity, i.price || '',
    i.manufacturer || '', i.expiryDate || ''
  ]);
  const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'mednear_inventory.csv'; a.click();
  URL.revokeObjectURL(url);
  showToast('Inventory exported!', 'success');
}

// ── Bulk Import ───────────────────────────────────────────────
function triggerBulkImport() {
  const input = document.getElementById('bulk-import-file');
  if (input) input.click();
}

function handleBulkImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const lines = ev.target.result.split('\n').slice(1); // skip header
      const imported = lines.filter(l => l.trim()).map(line => {
        const [medicineName, category, quantity, price, manufacturer, expiryDate] = line.split(',').map(v => v.replace(/"/g,'').trim());
        return { medicineName, category, quantity: parseInt(quantity)||0, price: parseFloat(price)||0, manufacturer, expiryDate, id: 'imp_' + Date.now() + Math.random() };
      });
      DashState.inventory.push(...imported);
      renderInventoryTable();
      updateStats();
      showToast(`${imported.length} medicines imported!`, 'success');
    } catch { showToast('CSV format invalid.', 'error'); }
  };
  reader.readAsText(file);
}

// ── Demo Data ─────────────────────────────────────────────────
function getDemoInventory() {
  return [
    { id:'m1', medicineName:'Paracetamol 500mg', category:'Analgesic', quantity:124, price:12, manufacturer:'Sun Pharma', expiryDate:'2026-08-01' },
    { id:'m2', medicineName:'Azithromycin 500mg', category:'Antibiotic', quantity:38, price:85, manufacturer:'Cipla', expiryDate:'2026-12-15' },
    { id:'m3', medicineName:'Cetirizine 10mg', category:'Antihistamine', quantity:7, price:18, manufacturer:'Dr. Reddy\'s', expiryDate:'2026-03-20' },
    { id:'m4', medicineName:'Omeprazole 20mg', category:'GI', quantity:0, price:35, manufacturer:'Alkem', expiryDate:'2025-11-10' },
    { id:'m5', medicineName:'Metformin 500mg', category:'Antidiabetic', quantity:55, price:22, manufacturer:'Glenmark', expiryDate:'2027-02-28' },
    { id:'m6', medicineName:'Atorvastatin 10mg', category:'Cardiovascular', quantity:3, price:48, manufacturer:'Lupin', expiryDate:'2026-04-05' },
  ];
}

// ── Page Init calls ───────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    initStoreRegForm();
    initInventorySearch();
    const medForm = document.getElementById('med-form');
    if (medForm) medForm.addEventListener('submit', saveMedicine);
    const bulkFile = document.getElementById('bulk-import-file');
    if (bulkFile) bulkFile.addEventListener('change', handleBulkImport);
  }, 100);
});
