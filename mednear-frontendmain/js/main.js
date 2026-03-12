/* ============================================================
   MedNear — main.js
   Customer Flow: Location detection + Medicine search
   ============================================================ */

// ── State ─────────────────────────────────────────────────────
const State = {
  userLat: null,
  userLng: null,
  locationAllowed: false,
  searchRadius: 5000,
  currentResults: [],
  selectedPharmacy: null,
};

// ── DOM Ready ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initPageLoader();
  initNavScroll();
  initLocationRequest();
  initSearchForm();
  initRadiusSlider();
  initCategoryFilter();
  initMobileMenu();
  updateAuthNav();
});

// ── Page Loader ───────────────────────────────────────────────
function initPageLoader() {
  const loader = document.getElementById('page-loader');
  if (!loader) return;
  window.addEventListener('load', () => {
    setTimeout(() => loader.classList.add('hidden'), 400);
  });
}

// ── Navbar scroll effect ──────────────────────────────────────
function initNavScroll() {
  const nav = document.querySelector('.navbar');
  if (!nav) return;
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 20);
  });
}

// ── Auth Nav ──────────────────────────────────────────────────
function updateAuthNav() {
  const loginLink  = document.getElementById('nav-login');
  const logoutLink = document.getElementById('nav-logout');
  const ownerLink  = document.getElementById('nav-owner');
  if (!loginLink) return;

  if (API.isLoggedIn()) {
    loginLink.classList.add('hidden');
    if (logoutLink) logoutLink.classList.remove('hidden');
    if (ownerLink)  ownerLink.classList.remove('hidden');
  } else {
    loginLink.classList.remove('hidden');
    if (logoutLink) logoutLink.classList.add('hidden');
    if (ownerLink)  ownerLink.classList.add('hidden');
  }

  if (logoutLink) {
    logoutLink.addEventListener('click', (e) => {
      e.preventDefault(); API.logout();
    });
  }
}

// ── Mobile Menu ───────────────────────────────────────────────
function initMobileMenu() {
  const hamburger = document.getElementById('hamburger');
  const mobileMenu = document.getElementById('mobile-menu');
  if (!hamburger || !mobileMenu) return;
  hamburger.addEventListener('click', () => {
    mobileMenu.classList.toggle('open');
    hamburger.setAttribute('aria-expanded', mobileMenu.classList.contains('open'));
  });
}

// ── Location Request ──────────────────────────────────────────
function initLocationRequest() {
  const grantBtn   = document.getElementById('grant-location-btn');
  const manualBtn  = document.getElementById('manual-location-btn');
  const locationEl = document.getElementById('location-status');
  const searchSec  = document.getElementById('search-section');
  const locationSec = document.getElementById('location-section');

  if (grantBtn) grantBtn.addEventListener('click', requestLocation);
  if (manualBtn) manualBtn.addEventListener('click', openManualLocation);

  // Auto-try if previously allowed
  if (navigator.permissions) {
    navigator.permissions.query({ name: 'geolocation' }).then(result => {
      if (result.state === 'granted') requestLocation(true);
    });
  }

  function requestLocation(silent = false) {
    if (!silent && grantBtn) setButtonLoading(grantBtn, true, 'Detecting...');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        State.userLat = pos.coords.latitude;
        State.userLng = pos.coords.longitude;
        State.locationAllowed = true;

        if (grantBtn) setButtonLoading(grantBtn, false);
        if (locationEl) {
          locationEl.innerHTML = `<span class="ping-dot"></span>&nbsp; Location detected`;
          locationEl.classList.add('text-teal');
        }

        revGeocodeDisplay(State.userLat, State.userLng);
        showSearchSection();
      },
      (err) => {
        if (grantBtn) setButtonLoading(grantBtn, false);
        if (!silent) showToast('Location access denied. Please enter manually.', 'warning');
        if (locationSec) showManualInput();
      },
      { timeout: 10000, maximumAge: 60000 }
    );
  }

  function revGeocodeDisplay(lat, lng) {
    fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`)
      .then(r => r.json())
      .then(data => {
        const addr = data.address;
        const display = [addr.suburb || addr.neighbourhood, addr.city || addr.town, addr.state]
          .filter(Boolean).join(', ');
        const locName = document.getElementById('location-name');
        if (locName) locName.textContent = display || 'Your location';
      })
      .catch(() => {});
  }

  function showSearchSection() {
    const locSection = document.getElementById('location-section');
    const searchSection = document.getElementById('search-section');
    if (locSection)   locSection.classList.add('hidden');
    if (searchSection) {
      searchSection.classList.remove('hidden');
      searchSection.classList.add('animate-fadeUp');
    }
  }

  function showManualInput() {
    const manualInput = document.getElementById('manual-input-section');
    if (manualInput) manualInput.classList.remove('hidden');
  }
}

// ── Manual Location ───────────────────────────────────────────
function openManualLocation() {
  const modal = document.getElementById('manual-location-modal');
  if (modal) modal.classList.add('open');
}

function closeManualModal() {
  const modal = document.getElementById('manual-location-modal');
  if (modal) modal.classList.remove('open');
}

function submitManualLocation(e) {
  if (e) e.preventDefault();
  const input = document.getElementById('manual-city-input');
  const val = input ? input.value.trim() : '';
  if (!val) { showToast('Please enter a city or address.', 'error'); return; }

  const btn = document.getElementById('manual-submit-btn');
  setButtonLoading(btn, true, 'Searching...');

  fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(val)}&format=json&limit=1`)
    .then(r => r.json())
    .then(results => {
      setButtonLoading(btn, false);
      if (!results.length) { showToast('Location not found. Try again.', 'error'); return; }
      State.userLat = parseFloat(results[0].lat);
      State.userLng = parseFloat(results[0].lon);
      State.locationAllowed = true;

      const locName = document.getElementById('location-name');
      if (locName) locName.textContent = results[0].display_name.split(',').slice(0,2).join(',');

      closeManualModal();
      const locSection  = document.getElementById('location-section');
      const searchSection = document.getElementById('search-section');
      if (locSection) locSection.classList.add('hidden');
      if (searchSection) { searchSection.classList.remove('hidden'); searchSection.classList.add('animate-fadeUp'); }
      showToast(`Location set to ${val}`, 'success');
    })
    .catch(() => { setButtonLoading(btn, false); showToast('Network error. Try again.', 'error'); });
}

// ── Search Form ───────────────────────────────────────────────
function initSearchForm() {
  const form = document.getElementById('medicine-search-form');
  const input = document.getElementById('medicine-input');
  const clearBtn = document.getElementById('clear-search');
  const suggestList = document.getElementById('suggestions-list');

  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const query = input ? input.value.trim() : '';
    if (!query) { showToast('Please enter a medicine name.', 'warning'); return; }
    if (!State.locationAllowed) { showToast('Please allow location first.', 'warning'); return; }
    performSearch(query);
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (input) input.value = '';
      clearBtn.classList.add('hidden');
      hideSuggestions();
      clearResults();
    });
  }

  // Show/hide clear button
  if (input) {
    input.addEventListener('input', () => {
      if (clearBtn) clearBtn.classList.toggle('hidden', !input.value);
      fetchSuggestions(input.value);
    });
  }

  // Close suggestions on outside click
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-box')) hideSuggestions();
  });
}

// ── Suggestions ───────────────────────────────────────────────
let suggestTimeout;
function fetchSuggestions(query) {
  clearTimeout(suggestTimeout);
  const list = document.getElementById('suggestions-list');
  if (!list || query.length < 2) { hideSuggestions(); return; }

  suggestTimeout = setTimeout(() => {
    // Static suggestions for demo; replace with API call
    const demoMeds = [
      'Paracetamol','Ibuprofen','Amoxicillin','Azithromycin','Cetirizine',
      'Metformin','Atorvastatin','Omeprazole','Pantoprazole','Clopidogrel',
      'Aspirin','Dolo 650','Crocin','Allegra','Combiflam','Vicks','Dettol'
    ];
    const filtered = demoMeds.filter(m => m.toLowerCase().startsWith(query.toLowerCase()));
    renderSuggestions(filtered.slice(0, 6));
  }, 250);
}

function renderSuggestions(items) {
  const list = document.getElementById('suggestions-list');
  if (!list) return;
  if (!items.length) { hideSuggestions(); return; }

  list.innerHTML = items.map(item => `
    <li class="suggestion-item" onclick="selectSuggestion('${item}')">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
      </svg>
      ${item}
    </li>`).join('');
  list.classList.remove('hidden');
}

function hideSuggestions() {
  const list = document.getElementById('suggestions-list');
  if (list) list.classList.add('hidden');
}

function selectSuggestion(name) {
  const input = document.getElementById('medicine-input');
  if (input) { input.value = name; }
  hideSuggestions();
  performSearch(name);
}

// ── Perform Search ────────────────────────────────────────────
async function performSearch(query) {
  const resultsSection = document.getElementById('results-section');
  const resultsGrid    = document.getElementById('results-grid');
  const resultsMeta    = document.getElementById('results-meta');
  const searchBtn      = document.getElementById('search-btn');

  if (searchBtn) setButtonLoading(searchBtn, true, 'Searching...');
  if (resultsSection) resultsSection.classList.remove('hidden');
  if (resultsGrid) resultsGrid.innerHTML = renderSkeletons(3);

  try {
    // Attempt API call — falls back to demo data if offline
    let results;
    try {
      results = await API.medicines.search(query, State.userLat, State.userLng, State.searchRadius);
    } catch {
      results = getDemoResults(query);
    }

    State.currentResults = results;
    if (searchBtn) setButtonLoading(searchBtn, false);

    if (resultsMeta) {
      resultsMeta.textContent = `${results.length} pharmacies found for "${query}"`;
    }

    if (!results.length) {
      resultsGrid.innerHTML = renderEmptyState(query);
      return;
    }

    resultsGrid.innerHTML = results.map((r, i) => renderPharmacyCard(r, i)).join('');
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

  } catch (err) {
    if (searchBtn) setButtonLoading(searchBtn, false);
    showToast(err.message || 'Search failed. Try again.', 'error');
    if (resultsGrid) resultsGrid.innerHTML = renderEmptyState(query);
  }
}

// ── Render Pharmacy Card ──────────────────────────────────────
function renderPharmacyCard(store, index) {
  const availClass = store.quantity > 10 ? 'in' : store.quantity > 0 ? 'low' : 'out';
  const availText  = store.quantity > 10 ? 'In Stock' : store.quantity > 0 ? 'Low Stock' : 'Out of Stock';
  const badgeClass = store.quantity > 10 ? 'badge-green' : store.quantity > 0 ? 'badge-warn' : 'badge-red';

  return `
  <div class="pharmacy-card animate-fadeUp" style="animation-delay:${index * 0.08}s"
       onclick="openPharmacyModal(${index})">
    <div>
      <div class="flex items-center gap-8 mb-4">
        <span class="avail-dot ${availClass}"></span>
        <span class="pharmacy-name">${store.name || 'Pharmacy'}</span>
        <span class="badge ${badgeClass}">${availText}</span>
      </div>
      <div class="pharmacy-address">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline;vertical-align:middle;margin-right:4px">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
        </svg>
        ${store.address || '—'}
      </div>
      <div class="pharmacy-meta">
        ${store.distance ? `<span class="pharmacy-meta-item">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          ${formatDistance(store.distance)} away
        </span>` : ''}
        ${store.phone ? `<span class="pharmacy-meta-item">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.72 19.79 19.79 0 0 1 1.61 5.1 2 2 0 0 1 3.58 3h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 10.09a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
          ${store.phone}
        </span>` : ''}
        ${store.openNow !== undefined ? `<span class="pharmacy-meta-item">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${store.openNow ? 'var(--teal)' : 'var(--danger)'}" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <span style="color:${store.openNow ? 'var(--teal)' : 'var(--danger)'}">${store.openNow ? 'Open Now' : 'Closed'}</span>
        </span>` : ''}
      </div>
    </div>
    <div class="flex flex-col gap-8" style="align-items:flex-end">
      ${store.price ? `<div class="text-teal font-bold" style="font-size:1.1rem">₹${store.price}</div>` : ''}
      <button class="btn btn-outline btn-sm" onclick="event.stopPropagation();callPharmacy('${store.phone}')">Call</button>
      <button class="btn btn-primary btn-sm" onclick="event.stopPropagation();getDirections(${store.lat},${store.lng})">Directions</button>
    </div>
  </div>`;
}

// ── Pharmacy Modal ────────────────────────────────────────────
function openPharmacyModal(index) {
  const store = State.currentResults[index];
  if (!store) return;
  State.selectedPharmacy = store;

  const modal = document.getElementById('pharmacy-modal');
  if (!modal) return;

  document.getElementById('modal-store-name').textContent = store.name || 'Pharmacy';
  document.getElementById('modal-store-address').textContent = store.address || '—';
  document.getElementById('modal-store-phone').textContent = store.phone || '—';
  document.getElementById('modal-store-hours').textContent =
    store.openTime && store.closeTime ? `${formatTime(store.openTime)} – ${formatTime(store.closeTime)}` : '—';

  const qty = store.quantity || 0;
  const availEl = document.getElementById('modal-availability');
  availEl.innerHTML = qty > 10
    ? `<span class="badge badge-green">✓ In Stock (${qty} units)</span>`
    : qty > 0
    ? `<span class="badge badge-warn">⚠ Low Stock (${qty} units)</span>`
    : `<span class="badge badge-red">✕ Out of Stock</span>`;

  const dirBtn = document.getElementById('modal-directions-btn');
  if (dirBtn) dirBtn.onclick = () => getDirections(store.lat, store.lng);

  const callBtn = document.getElementById('modal-call-btn');
  if (callBtn) callBtn.onclick = () => callPharmacy(store.phone);

  modal.classList.add('open');
}

function closePharmacyModal() {
  const modal = document.getElementById('pharmacy-modal');
  if (modal) modal.classList.remove('open');
}

// ── Utility Actions ───────────────────────────────────────────
function callPharmacy(phone) {
  if (phone) window.location.href = `tel:${phone}`;
  else showToast('Phone number not available.', 'warning');
}

function getDirections(lat, lng) {
  if (lat && lng) window.open(`https://maps.google.com/?daddr=${lat},${lng}`, '_blank');
  else showToast('Location coordinates not available.', 'warning');
}

function clearResults() {
  const resultsSection = document.getElementById('results-section');
  if (resultsSection) resultsSection.classList.add('hidden');
  State.currentResults = [];
}

// ── Radius Slider ─────────────────────────────────────────────
function initRadiusSlider() {
  const slider  = document.getElementById('radius-slider');
  const display = document.getElementById('radius-display');
  if (!slider) return;

  slider.addEventListener('input', () => {
    State.searchRadius = parseInt(slider.value);
    if (display) display.textContent = formatDistance(State.searchRadius);
  });
}

// ── Category Filter ───────────────────────────────────────────
function initCategoryFilter() {
  const pills = document.querySelectorAll('.category-pill');
  pills.forEach(pill => {
    pill.addEventListener('click', () => {
      pills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      const cat = pill.dataset.category;
      if (cat !== 'all') {
        const input = document.getElementById('medicine-input');
        if (input) { input.value = cat; performSearch(cat); }
      }
    });
  });
}

// ── Skeleton Loaders ──────────────────────────────────────────
function renderSkeletons(count) {
  return Array.from({ length: count }, () => `
    <div class="pharmacy-card">
      <div style="flex:1">
        <div class="skeleton" style="width:60%;height:18px;margin-bottom:10px"></div>
        <div class="skeleton" style="width:80%;height:12px;margin-bottom:8px"></div>
        <div class="skeleton" style="width:40%;height:12px"></div>
      </div>
    </div>`).join('');
}

function renderEmptyState(query) {
  return `
    <div class="text-center" style="padding:60px 20px;grid-column:1/-1">
      <div style="font-size:3rem;margin-bottom:16px">💊</div>
      <h3 style="margin-bottom:8px">No Results Found</h3>
      <p class="text-muted">No pharmacies near you stock "<strong>${query}</strong>".<br>Try increasing the search radius or check spelling.</p>
    </div>`;
}

// ── Demo Data (offline fallback) ──────────────────────────────
function getDemoResults(query) {
  return [
    { name: 'Apollo Pharmacy', address: '14 MG Road, Near City Mall', phone: '+91 98765 43210',
      distance: 420, quantity: 24, price: 45, openNow: true, openTime: '08:00', closeTime: '22:00', lat: 17.385, lng: 78.486 },
    { name: 'MedPlus Pharmacy', address: '56 Jubilee Hills, Road No 36', phone: '+91 91234 56789',
      distance: 890, quantity: 6, price: 42, openNow: true, openTime: '09:00', closeTime: '21:30', lat: 17.432, lng: 78.407 },
    { name: 'Wellness Forever', address: 'Banjara Hills, Near HDFC Bank', phone: '+91 80001 23456',
      distance: 1340, quantity: 0, price: 40, openNow: false, openTime: '10:00', closeTime: '20:00', lat: 17.415, lng: 78.449 },
    { name: 'Netmeds Store', address: 'KPHB Colony, Phase 3', phone: '+91 99887 76655',
      distance: 2100, quantity: 18, price: 38, openNow: true, openTime: '08:30', closeTime: '23:00', lat: 17.484, lng: 78.393 },
  ];
}
