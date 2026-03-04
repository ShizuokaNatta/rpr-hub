// ============================================================
// maps.js — RPR Hub
// Menangani: Submit peta, render kartu peta,
//            preview gambar, filter, sort, delete
// ============================================================

import { supabase }     from './supabase.js';
import { updateNavbar } from './auth.js';

// ─────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────
let currentUser     = null;
let currentUsername = null;
let allMaps         = [];
let filteredMaps    = [];
let displayedCount  = 0;
const PAGE_SIZE     = 12;
let searchQuery     = '';
let sortMode        = 'newest';

// ─────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────
async function init() {
  await updateNavbar();

  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    currentUser = session.user;
    const { data } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', currentUser.id)
      .single();
    currentUsername = data?.username || currentUser.email.split('@')[0];
  }

  renderFormPanel();
  await loadMaps();
  initFilters();
  initLoadMore();
}

// ─────────────────────────────────────────────
// RENDER FORM PANEL
// ─────────────────────────────────────────────
function renderFormPanel() {
  const container = document.getElementById('formContent');
  if (!container) return;

  if (!currentUser) {
    container.innerHTML = `
      <div class="login-prompt">
        <p>Login untuk mengunggah peta Roblox buatanmu ke komunitas.</p>
        <a href="login.html">Login Sekarang</a>
      </div>`;
    return;
  }

  container.innerHTML = `
    <!-- Judul Peta -->
    <div class="form-group">
      <label for="mapTitle">Judul Peta</label>
      <input type="text" id="mapTitle"
        placeholder="Nama peta buatanmu" maxlength="80" />
      <span class="field-error" id="mapTitleError"></span>
    </div>

    <!-- Deskripsi -->
    <div class="form-group">
      <label for="mapDesc">Deskripsi <span style="color:var(--clr-muted);font-weight:400">(opsional)</span></label>
      <textarea id="mapDesc"
        placeholder="Ceritakan tentang peta ini, genre, fitur unik, dll."
        maxlength="300"></textarea>
      <div class="char-counter" id="descCounter">0 / 300</div>
    </div>

    <!-- URL Gambar -->
    <div class="form-group">
      <label for="imageUrl">URL Gambar</label>
      <input type="url" id="imageUrl"
        placeholder="https://i.imgur.com/contoh.jpg" />
      <span class="field-error" id="imageUrlError"></span>

      <!-- Preview -->
      <div class="image-preview-wrap" id="imagePreviewWrap">
        <img id="imagePreview" alt="Preview peta" />
        <div class="image-preview-placeholder" id="imagePlaceholder">
          <span class="preview-icon">🖼️</span>
          <span>Preview gambar muncul di sini</span>
        </div>
      </div>
    </div>

    <!-- Link Roblox -->
    <div class="form-group">
      <label for="robloxLink">Link Game Roblox <span style="color:var(--clr-muted);font-weight:400">(opsional)</span></label>
      <input type="url" id="robloxLink"
        placeholder="https://www.roblox.com/games/..." />
      <span class="field-error" id="robloxLinkError"></span>
    </div>

    <!-- Submit -->
    <button class="btn-submit" id="submitMapBtn" type="button">
      🗺️ Unggah Peta
    </button>
  `;

  initImagePreview();
  initCharCounter();

  document.getElementById('submitMapBtn')
    ?.addEventListener('click', handleSubmitMap);
}

// ─────────────────────────────────────────────
// IMAGE URL PREVIEW
// ─────────────────────────────────────────────
function initImagePreview() {
  const input   = document.getElementById('imageUrl');
  const img     = document.getElementById('imagePreview');
  const ph      = document.getElementById('imagePlaceholder');
  if (!input || !img) return;

  let debounceTimer;

  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const url = input.value.trim();
      if (!url) {
        img.classList.remove('loaded');
        if (ph) ph.style.display = 'flex';
        return;
      }
      img.onload = () => {
        img.classList.add('loaded');
        if (ph) ph.style.display = 'none';
        setFieldError('imageUrl', '');
      };
      img.onerror = () => {
        img.classList.remove('loaded');
        if (ph) ph.style.display = 'flex';
      };
      img.src = url;
    }, 600);
  });
}

// ─────────────────────────────────────────────
// CHAR COUNTER DESKRIPSI
// ─────────────────────────────────────────────
function initCharCounter() {
  const ta = document.getElementById('mapDesc');
  const ct = document.getElementById('descCounter');
  if (!ta || !ct) return;
  ta.addEventListener('input', () => {
    const len = ta.value.length;
    ct.textContent = `${len} / 300`;
    ct.className = 'char-counter' +
      (len >= 300 ? ' at-limit' : len >= 250 ? ' near-limit' : '');
  });
}

// ─────────────────────────────────────────────
// VALIDASI
// ─────────────────────────────────────────────
function validateMapForm(title, imageUrl, robloxLink) {
  let valid = true;

  if (!title || title.trim().length < 3) {
    setFieldError('mapTitle', 'Judul peta minimal 3 karakter.');
    valid = false;
  } else setFieldError('mapTitle', '');

  if (!imageUrl || !isValidUrl(imageUrl)) {
    setFieldError('imageUrl', 'Masukkan URL gambar yang valid (http/https).');
    valid = false;
  } else setFieldError('imageUrl', '');

  if (robloxLink && !isValidUrl(robloxLink)) {
    setFieldError('robloxLink', 'URL Roblox tidak valid.');
    valid = false;
  } else setFieldError('robloxLink', '');

  return valid;
}

function isValidUrl(str) {
  try { const u = new URL(str); return u.protocol === 'http:' || u.protocol === 'https:'; }
  catch { return false; }
}

function setFieldError(field, msg) {
  const idMap = { mapTitle: 'mapTitleError', imageUrl: 'imageUrlError', robloxLink: 'robloxLinkError' };
  const el    = document.getElementById(idMap[field]);
  const input = document.getElementById(field);
  if (el) el.textContent = msg;
  if (input) input.classList.toggle('is-error', !!msg);
}

// ─────────────────────────────────────────────
// SUBMIT PETA
// ─────────────────────────────────────────────
async function handleSubmitMap() {
  const title      = document.getElementById('mapTitle')?.value.trim();
  const desc       = document.getElementById('mapDesc')?.value.trim();
  const imageUrl   = document.getElementById('imageUrl')?.value.trim();
  const robloxLink = document.getElementById('robloxLink')?.value.trim();

  if (!validateMapForm(title, imageUrl, robloxLink)) return;

  setSubmitLoading(true);

  try {
    const { error } = await supabase.from('maps').insert({
      user_id:     currentUser.id,
      username:    currentUsername,
      title,
      description: desc || null,
      image_url:   imageUrl,
      roblox_link: robloxLink || null,
    });

    if (error) throw error;

    showFormAlert('success', '✅ Peta berhasil diunggah!');

    // Reset
    document.getElementById('mapTitle').value   = '';
    document.getElementById('mapDesc').value    = '';
    document.getElementById('imageUrl').value   = '';
    document.getElementById('robloxLink').value = '';
    document.getElementById('descCounter').textContent = '0 / 300';

    const img = document.getElementById('imagePreview');
    const ph  = document.getElementById('imagePlaceholder');
    if (img) img.classList.remove('loaded');
    if (ph)  ph.style.display = 'flex';

    await loadMaps();

  } catch (err) {
    console.error('[RPR Hub] Submit map error:', err);
    showFormAlert('error', '❌ Gagal mengunggah peta. Coba lagi.');
  } finally {
    setSubmitLoading(false);
  }
}

function setSubmitLoading(loading) {
  const btn = document.getElementById('submitMapBtn');
  if (!btn) return;
  btn.disabled = loading;
  btn.innerHTML = loading
    ? '<span class="spinner"></span> Mengunggah...'
    : '🗺️ Unggah Peta';
}

function showFormAlert(type, msg) {
  const el = document.getElementById('formAlert');
  if (!el) return;
  el.className = `form-alert ${type} show`;
  el.textContent = msg;
  setTimeout(() => { el.className = 'form-alert'; }, 4000);
}

// ─────────────────────────────────────────────
// LOAD MAPS
// ─────────────────────────────────────────────
async function loadMaps() {
  try {
    const { data, error } = await supabase
      .from('maps')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    allMaps = data || [];

    const totalEl = document.getElementById('totalMapCount');
    if (totalEl) totalEl.textContent = allMaps.length;

    applyFilters();

  } catch (err) {
    console.error('[RPR Hub] Load maps error:', err);
    document.getElementById('mapsGrid').innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">⚠️</span>
        <h3>Gagal memuat peta</h3>
        <p>Periksa koneksi dan refresh halaman.</p>
      </div>`;
  }
}

// ─────────────────────────────────────────────
// FILTER & SORT
// ─────────────────────────────────────────────
function initFilters() {
  document.getElementById('searchInput')?.addEventListener('input', e => {
    searchQuery    = e.target.value.trim().toLowerCase();
    displayedCount = 0;
    applyFilters();
  });

  document.getElementById('sortSelect')?.addEventListener('change', e => {
    sortMode       = e.target.value;
    displayedCount = 0;
    applyFilters();
  });
}

function applyFilters() {
  let result = allMaps.filter(m =>
    !searchQuery || m.title.toLowerCase().includes(searchQuery)
  );

  switch (sortMode) {
    case 'oldest': result.sort((a,b) => new Date(a.created_at) - new Date(b.created_at)); break;
    case 'az':     result.sort((a,b) => a.title.localeCompare(b.title)); break;
    case 'za':     result.sort((a,b) => b.title.localeCompare(a.title)); break;
    default:       result.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
  }

  filteredMaps   = result;
  displayedCount = 0;
  renderMaps(false);
}

// ─────────────────────────────────────────────
// RENDER MAPS
// ─────────────────────────────────────────────
function renderMaps(append = false) {
  const grid      = document.getElementById('mapsGrid');
  const headerEl  = document.getElementById('listHeader');
  const loadMoreW = document.getElementById('loadMoreWrap');
  if (!grid) return;

  const slice = filteredMaps.slice(displayedCount, displayedCount + PAGE_SIZE);
  displayedCount += slice.length;

  if (!append) {
    if (filteredMaps.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">🗺️</span>
          <h3>Belum ada peta</h3>
          <p>Jadilah yang pertama mengunggah peta Robloxmu!</p>
        </div>`;
      if (headerEl) headerEl.textContent = '0 peta ditemukan';
      if (loadMoreW) loadMoreW.style.display = 'none';
      return;
    }
    grid.innerHTML = '';
    if (headerEl) headerEl.textContent = `${filteredMaps.length} peta ditemukan`;
  }

  slice.forEach((map, idx) => {
    const card = buildMapCard(map, idx);
    grid.appendChild(card);
  });

  const hasMore = displayedCount < filteredMaps.length;
  if (loadMoreW) loadMoreW.style.display = hasMore ? 'block' : 'none';
}

// ─────────────────────────────────────────────
// BUILD MAP CARD
// ─────────────────────────────────────────────
function buildMapCard(map, idx) {
  const card = document.createElement('div');
  card.className = 'map-card';
  card.style.animationDelay = `${idx * 0.05}s`;

  const dateStr = new Date(map.created_at).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric'
  });

  const isOwner = currentUser && currentUser.id === map.user_id;

  card.innerHTML = `
    <!-- Image -->
    <div class="map-image-wrap">
      <img
        data-src="${escapeHtml(map.image_url)}"
        alt="${escapeHtml(map.title)}"
        loading="lazy"
      />
      <div class="map-image-placeholder">
        <span class="ph-icon">🖼️</span>
        <span>Memuat gambar...</span>
      </div>
      <div class="map-image-overlay"></div>
      ${map.roblox_link
        ? `<a href="${escapeHtml(map.roblox_link)}" target="_blank" rel="noopener noreferrer" class="map-roblox-link">
             ▶ Mainkan
           </a>`
        : ''
      }
    </div>

    <!-- Body -->
    <div class="map-card-body">
      <div class="map-title">${escapeHtml(map.title)}</div>
      ${map.description
        ? `<div class="map-description">${escapeHtml(map.description)}</div>`
        : '<div class="map-description" style="color:var(--clr-border);font-style:italic;">Tidak ada deskripsi.</div>'
      }
      <div class="map-card-footer">
        <span class="map-author">@${escapeHtml(map.username)}</span>
        <span class="map-date">${dateStr}</span>
        ${isOwner
          ? `<button class="btn-delete-map" data-id="${map.id}">🗑️</button>`
          : ''
        }
      </div>
    </div>
  `;

  // Lazy load gambar
  const img = card.querySelector('img[data-src]');
  const ph  = card.querySelector('.map-image-placeholder');
  if (img) {
    img.onload = () => { img.classList.add('loaded'); if (ph) ph.style.display = 'none'; };
    img.onerror = () => {
      if (ph) ph.innerHTML = '<span class="ph-icon">🚫</span><span>Gambar tidak tersedia</span>';
    };
    img.src = img.dataset.src;
  }

  // Delete
  if (isOwner) {
    card.querySelector('.btn-delete-map')
      ?.addEventListener('click', (e) => {
        e.stopPropagation();
        handleDeleteMap(map.id, card);
      });
  }

  return card;
}

// ─────────────────────────────────────────────
// DELETE MAP
// ─────────────────────────────────────────────
async function handleDeleteMap(mapId, cardEl) {
  if (!confirm('Hapus peta ini dari showcase? Tindakan ini tidak bisa dibatalkan.')) return;

  cardEl.style.opacity = '0.4';
  cardEl.style.pointerEvents = 'none';

  try {
    const { error } = await supabase
      .from('maps')
      .delete()
      .eq('id', mapId)
      .eq('user_id', currentUser.id);

    if (error) throw error;

    cardEl.style.transition = 'all 0.3s ease';
    cardEl.style.transform  = 'scale(0.9)';
    cardEl.style.opacity    = '0';

    setTimeout(() => {
      cardEl.remove();
      allMaps = allMaps.filter(m => m.id !== mapId);
      const totalEl = document.getElementById('totalMapCount');
      if (totalEl) totalEl.textContent = allMaps.length;
      applyFilters();
    }, 300);

  } catch (err) {
    console.error('[RPR Hub] Delete map error:', err);
    cardEl.style.opacity       = '1';
    cardEl.style.pointerEvents = 'auto';
    alert('Gagal menghapus peta. Coba lagi.');
  }
}

// ─────────────────────────────────────────────
// LOAD MORE
// ─────────────────────────────────────────────
function initLoadMore() {
  document.getElementById('loadMoreBtn')
    ?.addEventListener('click', () => renderMaps(true));
}

// ─────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

// ─────────────────────────────────────────────
// START
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => init());