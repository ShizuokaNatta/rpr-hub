// ============================================================
// auth.js — RPR Hub
// Menangani: Register, Login, Logout, Session Guard
// ============================================================

import { supabase } from './supabase.js';

// ─────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────

/**
 * Tampilkan pesan alert di auth card
 * @param {'error'|'success'|'info'} type
 * @param {string} message
 */
function showAlert(type, message) {
  const el = document.getElementById('authAlert');
  if (!el) return;
  const icons = { error: '❌', success: '✅', info: 'ℹ️' };
  el.className = `auth-alert ${type} show`;
  el.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${message}</span>`;
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideAlert() {
  const el = document.getElementById('authAlert');
  if (el) el.className = 'auth-alert';
}

/**
 * Set error teks di bawah field
 */
function setFieldError(fieldId, message) {
  const el = document.getElementById(fieldId + 'Error');
  const input = document.getElementById(fieldId);
  if (el) el.textContent = message;
  if (input) {
    if (message) input.classList.add('is-error');
    else input.classList.remove('is-error');
  }
}

function clearAllErrors() {
  document.querySelectorAll('.field-error').forEach(el => el.textContent = '');
  document.querySelectorAll('input').forEach(el => el.classList.remove('is-error'));
  hideAlert();
}

/**
 * Set loading state pada tombol
 */
function setLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  if (loading) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Memproses...';
  } else {
    btn.disabled = false;
  }
}

/**
 * Ambil username yang tersimpan di profile
 */
async function getUsername(userId) {
  const { data } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', userId)
    .single();
  return data?.username || null;
}

// ─────────────────────────────────────────────
// PASSWORD STRENGTH METER
// ─────────────────────────────────────────────
function checkPasswordStrength(password) {
  let score = 0;
  if (password.length >= 8)  score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  const levels = [
    { label: '',            color: '',        width: '0%'   },
    { label: 'Sangat Lemah', color: '#ff4d6d', width: '20%'  },
    { label: 'Lemah',        color: '#ff944d', width: '40%'  },
    { label: 'Cukup',        color: '#ffe066', width: '60%'  },
    { label: 'Kuat',         color: '#00e676', width: '80%'  },
    { label: 'Sangat Kuat',  color: '#00e5ff', width: '100%' },
  ];

  return levels[Math.min(score, 5)];
}

function initStrengthMeter() {
  const pwdInput   = document.getElementById('password');
  const fillEl     = document.getElementById('strengthFill');
  const labelEl    = document.getElementById('strengthLabel');
  if (!pwdInput || !fillEl) return;

  pwdInput.addEventListener('input', () => {
    const result = checkPasswordStrength(pwdInput.value);
    fillEl.style.width      = result.width;
    fillEl.style.background = result.color;
    if (labelEl) {
      labelEl.textContent   = result.label;
      labelEl.style.color   = result.color;
    }
  });
}

// ─────────────────────────────────────────────
// TOGGLE PASSWORD VISIBILITY
// ─────────────────────────────────────────────
function initTogglePasswords() {
  const pairs = [
    { btnId: 'togglePwd',     inputId: 'password' },
    { btnId: 'toggleConfirm', inputId: 'confirmPassword' },
  ];
  pairs.forEach(({ btnId, inputId }) => {
    const btn   = document.getElementById(btnId);
    const input = document.getElementById(inputId);
    if (!btn || !input) return;
    btn.addEventListener('click', () => {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.textContent = show ? '🙈' : '👁️';
    });
  });
}

// ─────────────────────────────────────────────
// VALIDASI REGISTER
// ─────────────────────────────────────────────
function validateRegisterForm(username, email, password, confirmPassword) {
  let valid = true;

  if (!username || username.trim().length < 3) {
    setFieldError('username', 'Username minimal 3 karakter.');
    valid = false;
  } else if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    setFieldError('username', 'Username hanya boleh huruf, angka, dan underscore.');
    valid = false;
  } else {
    setFieldError('username', '');
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    setFieldError('email', 'Masukkan email yang valid.');
    valid = false;
  } else {
    setFieldError('email', '');
  }

  if (!password || password.length < 8) {
    setFieldError('password', 'Password minimal 8 karakter.');
    valid = false;
  } else {
    setFieldError('password', '');
  }

  if (password !== confirmPassword) {
    setFieldError('confirm', 'Password tidak cocok.');
    valid = false;
  } else {
    setFieldError('confirm', '');
  }

  return valid;
}

// ─────────────────────────────────────────────
// REGISTER
// ─────────────────────────────────────────────
async function handleRegister() {
  clearAllErrors();

  const username        = document.getElementById('username')?.value.trim();
  const email           = document.getElementById('email')?.value.trim();
  const password        = document.getElementById('password')?.value;
  const confirmPassword = document.getElementById('confirmPassword')?.value;

  if (!validateRegisterForm(username, email, password, confirmPassword)) return;

  setLoading('registerBtn', true);

  try {
    // Cek username sudah dipakai
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username)
      .maybeSingle();

    if (existingUser) {
      setFieldError('username', 'Username sudah digunakan, coba yang lain.');
      setLoading('registerBtn', false);
      return;
    }

    // Daftar ke Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username }
      }
    });

    if (error) throw error;

    if (data.user && !data.session) {
      // Email confirmation required
      showAlert('success',
        '🎉 Pendaftaran berhasil! Cek email kamu untuk konfirmasi akun, lalu login.'
      );
      document.getElementById('registerBtn').textContent = 'Cek Emailmu ✉️';
    } else {
      // Auto-confirmed (email confirm off)
      showAlert('success', '🎉 Akun berhasil dibuat! Mengalihkan...');
      setTimeout(() => { window.location.href = 'index.html'; }, 1500);
    }

  } catch (err) {
    console.error('[RPR Hub] Register error:', err);
    const msg = parseSupabaseError(err.message);
    showAlert('error', msg);
  } finally {
    setLoading('registerBtn', false);
    const btn = document.getElementById('registerBtn');
    if (btn && btn.textContent === 'Memproses...' ) {
      btn.textContent = 'Daftar Sekarang';
    }
  }
}

// ─────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────
async function handleLogin() {
  clearAllErrors();

  const email    = document.getElementById('email')?.value.trim();
  const password = document.getElementById('password')?.value;

  let valid = true;
  if (!email) { setFieldError('email', 'Email wajib diisi.'); valid = false; }
  if (!password) { setFieldError('password', 'Password wajib diisi.'); valid = false; }
  if (!valid) return;

  setLoading('loginBtn', true);

  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    showAlert('success', `Selamat datang kembali! 👋 Mengalihkan...`);
    setTimeout(() => { window.location.href = 'index.html'; }, 1200);

  } catch (err) {
    console.error('[RPR Hub] Login error:', err);
    showAlert('error', parseSupabaseError(err.message));
  } finally {
    const btn = document.getElementById('loginBtn');
    if (btn) { btn.disabled = false; btn.textContent = 'Masuk'; }
  }
}

// ─────────────────────────────────────────────
// LOGOUT (dipanggil dari halaman lain)
// ─────────────────────────────────────────────
export async function handleLogout() {
  await supabase.auth.signOut();
  window.location.href = 'login.html';
}

// ─────────────────────────────────────────────
// PAGE GUARD — panggil di halaman yang butuh login
// ─────────────────────────────────────────────
export async function requireAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = 'login.html';
    return null;
  }
  return session;
}

// ─────────────────────────────────────────────
// UPDATE NAVBAR — tampilkan nama user atau tombol login
// ─────────────────────────────────────────────
export async function updateNavbar() {
  const { data: { session } } = await supabase.auth.getSession();
  const navAuth = document.getElementById('navAuth');
  if (!navAuth) return;

  if (session) {
    const username = await getUsername(session.user.id);
    navAuth.innerHTML = `
      <span class="nav-username">👤 ${username || session.user.email.split('@')[0]}</span>
      <button class="nav-btn nav-btn--outline" id="logoutBtn">Keluar</button>
    `;
    document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);
  } else {
    navAuth.innerHTML = `
      <a href="login.html"    class="nav-btn nav-btn--outline">Login</a>
      <a href="register.html" class="nav-btn nav-btn--primary">Daftar</a>
    `;
  }
}

// ─────────────────────────────────────────────
// TERJEMAHKAN ERROR SUPABASE
// ─────────────────────────────────────────────
function parseSupabaseError(message) {
  if (!message) return 'Terjadi kesalahan. Coba lagi.';
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials') || m.includes('invalid credentials'))
    return 'Email atau password salah.';
  if (m.includes('email not confirmed'))
    return 'Email belum dikonfirmasi. Cek inbox kamu.';
  if (m.includes('user already registered') || m.includes('already been registered'))
    return 'Email ini sudah terdaftar. Silakan login.';
  if (m.includes('password should be'))
    return 'Password terlalu lemah. Gunakan minimal 8 karakter.';
  if (m.includes('unable to validate email'))
    return 'Format email tidak valid.';
  if (m.includes('network') || m.includes('fetch'))
    return 'Koneksi gagal. Periksa internet kamu.';
  return message;
}

// ─────────────────────────────────────────────
// INIT — Deteksi halaman & pasang listener
// ─────────────────────────────────────────────
function init() {
  const path = window.location.pathname;

  // Halaman Register
  if (path.includes('register')) {
    initTogglePasswords();
    initStrengthMeter();

    document.getElementById('registerBtn')
      ?.addEventListener('click', handleRegister);

    // Enter key
    document.addEventListener('keydown', e => {
      if (e.key === 'Enter') handleRegister();
    });

    // Redirect jika sudah login
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) window.location.href = 'index.html';
    });
  }

  // Halaman Login
  if (path.includes('login')) {
    initTogglePasswords();

    document.getElementById('loginBtn')
      ?.addEventListener('click', handleLogin);

    document.addEventListener('keydown', e => {
      if (e.key === 'Enter') handleLogin();
    });

    // Redirect jika sudah login
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) window.location.href = 'index.html';
    });
  }
}

init();