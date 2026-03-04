// ============================================================
// reviews.js — RPR Hub
// Menangani: Tampil review, submit review, rating bintang,
//            filter, delete review milik sendiri
// ============================================================

import { supabase }              from './supabase.js';
import { updateNavbar }          from './auth.js';

// ─────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────
let currentUser     = null;
let currentUsername = null;
let selectedRating  = 0;
let allReviews      = [];
let filteredReviews = [];
let displayedCount  = 0;
const PAGE_SIZE     = 8;
let activeStarFilter = 0;
let searchQuery      = '';

// ─────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────
async function init() {
  await updateNavbar();

  // Cek sesi user
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
  await loadReviews();
  initFilters();
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
        <p>Login untuk menulis review dan berbagi pengalamanmu dengan komunitas.</p>
        <a href="login.html">Login Sekarang</a>
      </div>`;
    return;
  }

  container.innerHTML = `
    <!-- Nama Game -->
    <div class="form-group">
      <label for="gameName">Nama Game</label>
      <input type="text" id="gameName" placeholder="Contoh: Adopt Me!, Brookhaven" maxlength="80" />
      <span class="field-error" id="gameNameError"></span>
    </div>

    <!-- Roblox Game ID (opsional) -->
    <div class="form-group">
      <label for="gameId">Roblox Game ID <span style="color:var(--clr-muted);font-weight:400">(opsional)</span></label>
      <input type="text" id="gameId" placeholder="Contoh: 920587237" maxlength="20" />
    </div>

    <!-- Rating Bintang -->
    <div class="star-rating-group">
      <label>Rating</label>
      <div class="star-input-wrap">
        <div class="star-input" id="starInput" role="radiogroup" aria-label="Rating bintang 1 sampai 5">
          ${[1,2,3,4,5].map(n => `
            <button type="button"
              data-val="${n}"
              aria-label="${n} bintang"
              title="${n} bintang">★</button>
          `).join('')}
        </div>
        <span class="star-label-text" id="starLabelText">Pilih rating</span>
      </div>
      <span class="field-error" id="ratingError"></span>
    </div>

    <!-- Isi Review -->
    <div class="form-group">
      <label for="reviewContent">Ulasan</label>
      <textarea id="reviewContent"
        placeholder="Ceritakan pengalamanmu bermain game ini..."
        maxlength="600"></textarea>
      <div class="char-counter" id="charCounter">0 / 600</div>
      <span class="field-error" id="contentError"></span>
    </div>

    <!-- Submit -->
    <button class="btn-submit" id="submitReviewBtn" type="button">
      🚀 Kirim Review
    </button>
  `;

  initStarInput();
  initCharCounter();

  document.getElementById('submitReviewBtn')
    ?.addEventListener('click', handleSubmitReview);
}

// ─────────────────────────────────────────────
// STAR INPUT INTERAKTIF
// ─────────────────────────────────────────────
const STAR_LABELS = ['', 'Sangat Buruk', 'Kurang Bagus', 'Lumayan', 'Bagus', 'Luar Biasa!'];

function initStarInput() {
  const wrap = document.getElementById('starInput');
  if (!wrap) return;

  const btns = wrap.querySelectorAll('button');

  function paint(hovered) {
    btns.forEach((btn, i) => {
      btn.classList.toggle('filled', i < hovered);
      btn.classList.toggle('active', i === hovered - 1);
    });
    const labelEl = document.getElementById('starLabelText');
    if (labelEl) {
      labelEl.textContent = hovered ? STAR_LABELS[hovered] : 'Pilih rating';
      labelEl.style.color = hovered ? 'var(--clr-star-on)' : 'var(--clr-muted)';
    }
  }

  btns.forEach((btn, i) => {
    btn.addEventListener('mouseenter', () => paint(i + 1));
    btn.addEventListener('mouseleave', () => paint(selectedRating));
    btn.addEventListener('click', () => {
      selectedRating = i + 1;
      paint(selectedRating);
      setFieldError('rating', '');
    });
  });
}

// ─────────────────────────────────────────────
// CHAR COUNTER
// ─────────────────────────────────────────────
function initCharCounter() {
  const textarea = document.getElementById('reviewContent');
  const counter  = document.getElementById('charCounter');
  if (!textarea || !counter) return;

  textarea.addEventListener('input', () => {
    const len = textarea.value.length;
    counter.textContent = `${len} / 600`;
    counter.className = 'char-counter' +
      (len >= 600 ? ' at-limit' : len >= 500 ? ' near-limit' : '');
  });
}

// ─────────────────────────────────────────────
// VALIDASI FORM
// ─────────────────────────────────────────────
function validateForm(gameName, rating, content) {
  let valid = true;

  if (!gameName || gameName.trim().length < 2) {
    setFieldError('gameName', 'Nama game minimal 2 karakter.');
    valid = false;
  } else setFieldError('gameName', '');

  if (!rating || rating < 1 || rating > 5) {
    setFieldError('rating', 'Pilih rating bintang terlebih dahulu.');
    valid = false;
  } else setFieldError('rating', '');

  if (!content || content.trim().length < 10) {
    setFieldError('content', 'Ulasan minimal 10 karakter.');
    valid = false;
  } else setFieldError('content', '');

  return valid;
}

function setFieldError(field, msg) {
  const el    = document.getElementById(field + 'Error');
  const input = document.getElementById(field === 'gameName' ? 'gameName'
              : field === 'content' ? 'reviewContent' : null);
  if (el) el.textContent = msg;
  if (input) input.classList.toggle('is-error', !!msg);
}

// ─────────────────────────────────────────────
// SUBMIT REVIEW
// ─────────────────────────────────────────────
async function handleSubmitReview() {
  const gameName = document.getElementById('gameName')?.value.trim();
  const gameId   = document.getElementById('gameId')?.value.trim();
  const content  = document.getElementById('reviewContent')?.value.trim();

  if (!validateForm(gameName, selectedRating, content)) return;

  setSubmitLoading(true);

  try {
    const { error } = await supabase.from('reviews').insert({
      user_id:   currentUser.id,
      username:  currentUsername,
      game_name: gameName,
      game_id:   gameId || null,
      rating:    selectedRating,
      content:   content,
    });

    if (error) throw error;

    showFormAlert('success', '✅ Review berhasil dikirim! Terima kasih.');

    // Reset form
    document.getElementById('gameName').value       = '';
    document.getElementById('gameId').value         = '';
    document.getElementById('reviewContent').value  = '';
    document.getElementById('charCounter').textContent = '0 / 600';
    selectedRating = 0;
    initStarInput();

    // Reload list
    await loadReviews();

  } catch (err) {
    console.error('[RPR Hub] Submit review error:', err);
    showFormAlert('error', '❌ Gagal mengirim review. Coba lagi.');
  } finally {
    setSubmitLoading(false);
  }
}

function setSubmitLoading(loading) {
  const btn = document.getElementById('submitReviewBtn');
  if (!btn) return;
  if (loading) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Mengirim...';
  } else {
    btn.disabled = false;
    btn.innerHTML = '🚀 Kirim Review';
  }
}

function showFormAlert(type, msg) {
  const el = document.getElementById('formAlert');
  if (!el) return;
  el.className = `form-alert ${type} show`;
  el.textContent = msg;
  setTimeout(() => { el.className = 'form-alert'; }, 4000);
}

// ─────────────────────────────────────────────
// LOAD REVIEWS DARI SUPABASE
// ─────────────────────────────────────────────
async function loadReviews() {
  try {
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    allReviews = data || [];

    // Update total badge
    const totalEl = document.getElementById('totalReviewCount');
    if (totalEl) totalEl.textContent = allReviews.length;

    applyFilters();

  } catch (err) {
    console.error('[RPR Hub] Load reviews error:', err);
    document.getElementById('reviewsGrid').innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">⚠️</span>
        <h3>Gagal memuat review</h3>
        <p>Periksa koneksi internet dan refresh halaman.</p>
      </div>`;
  }
}

// ─────────────────────────────────────────────
// FILTER & SEARCH
// ─────────────────────────────────────────────
function initFilters() {
  // Search input
  const searchEl = document.getElementById('searchInput');
  if (searchEl) {
    searchEl.addEventListener('input', () => {
      searchQuery = searchEl.value.trim().toLowerCase();
      displayedCount = 0;
      applyFilters();
    });
  }

  // Star filter buttons
  document.querySelectorAll('.filter-stars button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-stars button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeStarFilter = parseInt(btn.dataset.star) || 0;
      displayedCount = 0;
      applyFilters();
    });
  });
}

function applyFilters() {
  filteredReviews = allReviews.filter(r => {
    const matchStar   = activeStarFilter === 0 || r.rating === activeStarFilter;
    const matchSearch = !searchQuery || r.game_name.toLowerCase().includes(searchQuery);
    return matchStar && matchSearch;
  });

  displayedCount = 0;
  renderReviews(false);
}

// ─────────────────────────────────────────────
// RENDER REVIEWS
// ─────────────────────────────────────────────
function renderReviews(append = false) {
  const grid       = document.getElementById('reviewsGrid');
  const headerEl   = document.getElementById('listHeader');
  const loadMoreW  = document.getElementById('loadMoreWrap');
  if (!grid) return;

  const slice = filteredReviews.slice(displayedCount, displayedCount + PAGE_SIZE);
  displayedCount += slice.length;

  if (!append) {
    if (filteredReviews.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">🔍</span>
          <h3>Belum ada review</h3>
          <p>Jadilah yang pertama menulis review!</p>
        </div>`;
      if (headerEl) headerEl.textContent = '0 review ditemukan';
      if (loadMoreW) loadMoreW.style.display = 'none';
      return;
    }
    grid.innerHTML = '';
    if (headerEl) headerEl.textContent =
      `${filteredReviews.length} review ditemukan`;
  }

  slice.forEach((review, idx) => {
    const card = buildReviewCard(review, idx);
    grid.appendChild(card);
  });

  // Load more button
  const hasMore = displayedCount < filteredReviews.length;
  if (loadMoreW) {
    loadMoreW.style.display = hasMore ? 'block' : 'none';
  }
}

// ─────────────────────────────────────────────
// BUILD REVIEW CARD
// ─────────────────────────────────────────────
function buildReviewCard(review, idx) {
  const card = document.createElement('div');
  card.className = 'review-card';
  card.style.animationDelay = `${idx * 0.06}s`;

  const stars = [1,2,3,4,5].map(n =>
    `<span class="star ${n <= review.rating ? 'filled' : ''}">★</span>`
  ).join('');

  const dateStr = new Date(review.created_at).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric'
  });

  const isOwner = currentUser && currentUser.id === review.user_id;

  card.innerHTML = `
    <div class="review-card-header">
      <div class="review-meta">
        <div class="review-game-name">${escapeHtml(review.game_name)}</div>
        <div class="review-author-row">
          <span class="review-author">@${escapeHtml(review.username)}</span>
          <span class="review-date">${dateStr}</span>
        </div>
      </div>
      <div class="review-stars-display">
        ${stars}
        <span class="review-rating-num">${review.rating}.0</span>
      </div>
    </div>
    <div class="review-content">${escapeHtml(review.content)}</div>
    <div class="review-card-footer">
      ${review.game_id
        ? `<span class="game-id-badge">ID: ${escapeHtml(review.game_id)}</span>`
        : '<span></span>'
      }
      ${isOwner
        ? `<button class="btn-delete-review" data-id="${review.id}">🗑️ Hapus</button>`
        : ''
      }
    </div>
  `;

  // Delete handler
  if (isOwner) {
    card.querySelector('.btn-delete-review')
      ?.addEventListener('click', () => handleDeleteReview(review.id, card));
  }

  return card;
}

// ─────────────────────────────────────────────
// DELETE REVIEW
// ─────────────────────────────────────────────
async function handleDeleteReview(reviewId, cardEl) {
  if (!confirm('Hapus review ini? Tindakan ini tidak bisa dibatalkan.')) return;

  cardEl.style.opacity = '0.4';
  cardEl.style.pointerEvents = 'none';

  try {
    const { error } = await supabase
      .from('reviews')
      .delete()
      .eq('id', reviewId)
      .eq('user_id', currentUser.id);

    if (error) throw error;

    cardEl.style.transition = 'all 0.3s ease';
    cardEl.style.transform  = 'scale(0.95)';
    cardEl.style.opacity    = '0';
    setTimeout(() => {
      cardEl.remove();
      allReviews = allReviews.filter(r => r.id !== reviewId);
      const totalEl = document.getElementById('totalReviewCount');
      if (totalEl) totalEl.textContent = allReviews.length;
      applyFilters();
    }, 300);

  } catch (err) {
    console.error('[RPR Hub] Delete review error:', err);
    cardEl.style.opacity       = '1';
    cardEl.style.pointerEvents = 'auto';
    alert('Gagal menghapus review. Coba lagi.');
  }
}

// ─────────────────────────────────────────────
// LOAD MORE
// ─────────────────────────────────────────────
function initLoadMore() {
  document.getElementById('loadMoreBtn')
    ?.addEventListener('click', () => renderReviews(true));
}

// ─────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

// ─────────────────────────────────────────────
// START
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  init().then(() => initLoadMore());
});