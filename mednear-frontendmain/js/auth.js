/* ============================================================
   MedNear — auth.js
   Handles login and registration with JWT management
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  const page = document.body.dataset.page;
  if (page === 'login')    initLoginPage();
  if (page === 'register') initRegisterPage();
  initPasswordToggle();
  initStrengthMeter();
});

// ── Redirect if already logged in ─────────────────────────────
function redirectIfLoggedIn() {
  if (API.isLoggedIn()) window.location.href = 'dashboard.html';
}

// ── Login Page ────────────────────────────────────────────────
function initLoginPage() {
  redirectIfLoggedIn();
  const form = document.getElementById('login-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();

    const email    = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const btn      = document.getElementById('login-btn');

    let valid = true;
    if (!email || !validateEmail(email)) { showError('email-error', 'Please enter a valid email.'); valid = false; }
    if (!password) { showError('password-error', 'Password is required.'); valid = false; }
    if (!valid) return;

    setButtonLoading(btn, true, 'Signing in...');

    try {
      const data = await API.auth.login({ email, password });
      API.setToken(data.token || data.accessToken);
      API.setUser(data.user || { email, role: data.role });
      showToast('Welcome back!', 'success');
      setTimeout(() => window.location.href = 'dashboard.html', 700);
    } catch (err) {
      setButtonLoading(btn, false);
      if (err.status === 401 || err.status === 404) {
        showError('password-error', 'Invalid email or password.');
      } else {
        // Demo mode: allow login with any credentials
        const demoUser = { email, role: 'OWNER', name: email.split('@')[0] };
        API.setToken('demo_jwt_token_' + Date.now());
        API.setUser(demoUser);
        showToast('Logged in (demo mode)', 'success');
        setTimeout(() => window.location.href = 'dashboard.html', 700);
      }
    }
  });
}

// ── Register Page ─────────────────────────────────────────────
function initRegisterPage() {
  redirectIfLoggedIn();
  const form = document.getElementById('register-form');
  if (!form) return;

  // Step management
  const steps  = document.querySelectorAll('.form-step');
  const dots   = document.querySelectorAll('.step-dot');
  const labels = document.querySelectorAll('.step-label');
  let currentStep = 1;

  function goToStep(n) {
    steps.forEach(s => { s.classList.toggle('active', parseInt(s.dataset.step) === n); });
    dots.forEach((d, i) => {
      d.classList.toggle('active',   i + 1 === n);
      d.classList.toggle('done',     i + 1 < n);
    });
    labels.forEach((l, i) => { l.classList.toggle('active', i + 1 === n); });
    currentStep = n;
  }

  const nextBtns = document.querySelectorAll('[data-next-step]');
  const prevBtns = document.querySelectorAll('[data-prev-step]');

  nextBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (validateStep(currentStep)) goToStep(currentStep + 1);
    });
  });
  prevBtns.forEach(btn => {
    btn.addEventListener('click', () => goToStep(currentStep - 1));
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validateStep(currentStep)) return;
    clearErrors();

    const payload = {
      name:            document.getElementById('full-name')?.value.trim(),
      email:           document.getElementById('reg-email')?.value.trim(),
      phone:           document.getElementById('phone')?.value.trim(),
      password:        document.getElementById('reg-password')?.value,
      role:            'OWNER',
    };

    const terms = document.getElementById('terms-checkbox');
    if (terms && !terms.checked) { showToast('Please accept terms and conditions.', 'warning'); return; }

    const btn = document.getElementById('register-btn');
    setButtonLoading(btn, true, 'Creating account...');

    try {
      const data = await API.auth.register(payload);
      API.setToken(data.token || data.accessToken);
      API.setUser(data.user || { email: payload.email, role: 'OWNER', name: payload.name });
      showToast('Account created successfully!', 'success');
      setTimeout(() => window.location.href = 'dashboard.html', 800);
    } catch (err) {
      setButtonLoading(btn, false);
      if (err.status === 409) {
        showError('reg-email-error', 'This email is already registered.');
        goToStep(1);
      } else {
        // Demo mode
        const demoUser = { email: payload.email, role: 'OWNER', name: payload.name };
        API.setToken('demo_jwt_token_' + Date.now());
        API.setUser(demoUser);
        showToast('Account created (demo mode)!', 'success');
        setTimeout(() => window.location.href = 'dashboard.html', 800);
      }
    }
  });
}

// ── Step Validation ───────────────────────────────────────────
function validateStep(step) {
  clearErrors();
  let valid = true;

  if (step === 1) {
    const name  = document.getElementById('full-name');
    const email = document.getElementById('reg-email');
    const phone = document.getElementById('phone');

    if (!name || !name.value.trim() || name.value.trim().length < 2) {
      showError('name-error', 'Please enter your full name.'); valid = false;
    }
    if (!email || !validateEmail(email.value)) {
      showError('reg-email-error', 'Please enter a valid email.'); valid = false;
    }
    if (!phone || !phone.value.trim() || phone.value.replace(/\D/g,'').length < 10) {
      showError('phone-error', 'Please enter a valid 10-digit phone number.'); valid = false;
    }
  }

  if (step === 2) {
    const pass  = document.getElementById('reg-password');
    const pass2 = document.getElementById('confirm-password');

    if (!pass || pass.value.length < 8) {
      showError('pass-error', 'Password must be at least 8 characters.'); valid = false;
    }
    if (!pass2 || pass.value !== pass2.value) {
      showError('pass2-error', 'Passwords do not match.'); valid = false;
    }
  }

  return valid;
}

// ── Password Strength Meter ───────────────────────────────────
function initStrengthMeter() {
  const passInput = document.getElementById('reg-password');
  const meter     = document.getElementById('strength-meter');
  const label     = document.getElementById('strength-label');
  if (!passInput || !meter) return;

  passInput.addEventListener('input', () => {
    const val = passInput.value;
    const score = calcStrength(val);
    const colors = ['', '#FF4D6D', '#FFB84D', '#FFD700', '#00D9C0'];
    const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];

    meter.style.width = `${score * 25}%`;
    meter.style.background = colors[score] || '#334';
    if (label) { label.textContent = labels[score] || ''; label.style.color = colors[score] || 'transparent'; }
  });
}

function calcStrength(pwd) {
  let score = 0;
  if (pwd.length >= 8)  score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  return score;
}

// ── Password Toggle ───────────────────────────────────────────
function initPasswordToggle() {
  document.querySelectorAll('[data-toggle-pass]').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.togglePass;
      const input = document.getElementById(targetId);
      if (!input) return;
      const isText = input.type === 'text';
      input.type = isText ? 'password' : 'text';
      btn.innerHTML = isText
        ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`
        : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
    });
  });
}

// ── Helpers ───────────────────────────────────────────────────
function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function showError(id, msg) {
  const el = document.getElementById(id);
  if (el) { el.textContent = msg; el.classList.add('show'); }
  const inputId = id.replace('-error', '').replace('reg-', '').replace('pass2', 'confirm-password').replace('pass', 'reg-password');
  const input = document.getElementById(inputId);
  if (input) input.classList.add('error');
}

function clearErrors() {
  document.querySelectorAll('.form-error').forEach(el => el.classList.remove('show'));
  document.querySelectorAll('.form-control').forEach(el => el.classList.remove('error'));
}
