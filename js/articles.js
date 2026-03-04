// ============================================================
// articles.js — RPR Hub
// Menangani: List artikel, submit artikel, detail artikel,
//            search, sort, delete, estimasi waktu baca
// ============================================================

import { supabase }     from './supabase.js';
import { updateNavbar } from './auth.js';

// ─────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────
let currentUser     = null;
let currentUsername = null;
let allArticles     = [];
let filteredArticles = [];
let displayedCount  = 0;
const PAGE_SIZE     = 9;
let searchQuery     = '';
let sortMode        = 'newest';

// ─────────────────────────────────────────────
// INIT — deteksi halaman
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

  const path = window.location.pathname;

  if (path.includes('article-detail')) {
    await initDetailPage();
  } else {
    renderFormPanel();
    await loadArticles();
    initFilters();
    initLoadMore();
  }
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
        <p>Login untuk menulis artikel dan berbagi tips dengan komunitas RPR Hub.</p>
        <a href="login.html">Login Sekarang</a>
      </div>`;
    return;
  }

  container.innerHTML = `
    <!-- Judul -->
    <div class="form-group">
      <label for="articleTitle">Judul Artikel</label>
      <input type="text" id="articleTitle"
        placeholder="Judul yang menarik perhatian..." maxlength="120" />
      <span class="field-error" id="titleError"></span>
    </div>

    <!-- URL Cover (opsional) -->
    <div class="form-group">
      <label for="coverUrl">URL Gambar Cover
        <span style="color:var(--clr-muted);font-weight:400">(opsional)</span>
      </label>
      <input type="url" id="coverUrl"
        placeholder="https://i.imgur.com/contoh.jpg" />
      <div class="cover-preview-wrap" id="coverPreviewWrap">
        <img id="coverPreview" alt="Preview cover" />
        <div class="cover-placeholder" id="coverPlaceholder">
          <span class="ph-icon">🖼️</span>
          <span>Preview cover</span>
        </div>
      </div>
    </div>

    <!-- Isi Artikel -->
    <div class="form-group">
      <label for="articleContent">Isi Artikel</label>
      <textarea id="articleContent" class="tall"
        placeholder="Tulis artikel, tips, atau panduan Roblox kamu di sini..."
        maxlength="5000"></textarea>
      <div class="char-counter" id="contentCounter">0 / 5000</div>
      <span class="field-error" id="contentError"></span>
    </div>

    <!-- Submit -->
    <button class="btn-submit" id="submitArticleBtn" type="button">
      📝 Publikasikan Artikel
    </button>
  `;

  initCoverPreview();
  initContentCounter();

  document.getElementById('submitArticleBtn')
    ?.addEventListener('click', handleSubmitArticle);
}

// ─────────────────────────────────────────────
// COVER URL PREVIEW
// ─────────────────────────────────────────────
function initCoverPreview() {
  const input = document.getElementById('coverUrl');
  const img   = document.getElementById('coverPreview');
  const ph    = document.getElementById('coverPlaceholder');
  if (!input || !img) return;

  let timer;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const url = input.value.trim();
      if (!url) { img.classList.remove('loaded'); if (ph) ph.style.display = 'flex'; return; }
      img.onload  = () => { img.classList.add('loaded'); if (ph) ph.style.display = 'none'; };
      img.onerror = () => { img.classList.remove('loaded'); if (ph) ph.style.display = 'flex'; };
      img.src = url;
    }, 600);
  });
}

// ─────────────────────────────────────────────
// CONTENT CHAR COUNTER
// ─────────────────────────────────────────────
function initContentCounter() {
  const ta = document.getElementById('articleContent');
  const ct = document.getElementById('contentCounter');
  if (!ta || !ct) return;
  ta.addEventListener('input', () => {
    const len = ta.value.length;
    ct.textContent = `${len} / 5000`;
    ct.className = 'char-counter' +
      (len >= 5000 ? ' at-limit' : len >= 4500 ? ' near-limit' : '');
  });
}

// ─────────────────────────────────────────────
// VALIDASI
// ─────────────────────────────────────────────
function validateArticleForm(title, content) {
  let valid = true;

  if (!title || title.trim().length < 5) {
    setFieldError('title', 'Judul minimal 5 karakter.');
    valid = false;
  } else setFieldError('title', '');

  if (!content || content.trim().length < 30) {
    setFieldError('content', 'Isi artikel minimal 30 karakter.');
    valid = false;
  } else setFieldError('content', '');

  return valid;
}

function setFieldError(field, msg) {
  const idMap = { title: 'titleError', content: 'contentError' };
  const inputId = { title: 'articleTitle', content: 'articleContent' };
  const el    = document.getElementById(idMap[field]);
  const input = document.getElementById(inputId[field]);
  if (el) el.textContent = msg;
  if (input) input.classList.toggle('is-error', !!msg);
}

// ─────────────────────────────────────────────
// SUBMIT ARTIKEL
// ─────────────────────────────────────────────
async function handleSubmitArticle() {
  const title   = document.getElementById('articleTitle')?.value.trim();
  const cover   = document.getElementById('coverUrl')?.value.trim();
  const content = document.getElementById('articleContent')?.value.trim();

  if (!validateArticleForm(title, content)) return;

  setSubmitLoading(true);

  try {
    const { error } = await supabase.from('articles').insert({
      user_id:   currentUser.id,
      username:  currentUsername,
      title,
      content,
      cover_url: cover || null,
    });

    if (error) throw error;

    showFormAlert('success', '✅ Artikel berhasil dipublikasikan!');

    // Reset
    document.getElementById('articleTitle').value   = '';
    document.getElementById('coverUrl').value       = '';
    document.getElementById('articleContent').value = '';
    document.getElementById('contentCounter').textContent = '0 / 5000';

    const img = document.getElementById('coverPreview');
    const ph  = document.getElementById('coverPlaceholder');
    if (img) img.classList.remove('loaded');
    if (ph)  ph.style.display = 'flex';

    await loadArticles();

  } catch (err) {
    console.error('[RPR Hub] Submit article error:', err);
    showFormAlert('error', '❌ Gagal mempublikasikan artikel. Coba lagi.');
  } finally {
    setSubmitLoading(false);
  }
}

function setSubmitLoading(loading) {
  const btn = document.getElementById('submitArticleBtn');
  if (!btn) return;
  btn.disabled = loading;
  btn.innerHTML = loading
    ? '<span class="spinner"></span> Memproses...'
    : '📝 Publikasikan Artikel';
}

function showFormAlert(type, msg) {
  const el = document.getElementById('formAlert');
  if (!el) return;
  el.className = `form-alert ${type} show`;
  el.textContent = msg;
  setTimeout(() => { el.className = 'form-alert'; }, 4500);
}

// ─────────────────────────────────────────────
// LOAD ARTICLES
// ─────────────────────────────────────────────
async function loadArticles() {
  try {
    const { data, error } = await supabase
      .from('articles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    allArticles = data || [];

    const totalEl = document.getElementById('totalArticleCount');
    if (totalEl) totalEl.textContent = allArticles.length;

    applyFilters();

  } catch (err) {
    console.error('[RPR Hub] Load articles error:', err);
    document.getElementById('articlesGrid').innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">⚠️</span>
        <h3>Gagal memuat artikel</h3>
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
  let result = allArticles.filter(a =>
    !searchQuery || a.title.toLowerCase().includes(searchQuery)
  );

  switch (sortMode) {
    case 'oldest': result.sort((a,b) => new Date(a.created_at) - new Date(b.created_at)); break;
    case 'az':     result.sort((a,b) => a.title.localeCompare(b.title)); break;
    case 'za':     result.sort((a,b) => b.title.localeCompare(a.title)); break;
    default:       result.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
  }

  filteredArticles = result;
  displayedCount   = 0;
  renderArticles(false);
}

// ─────────────────────────────────────────────
// RENDER ARTICLE LIST
// ─────────────────────────────────────────────
function renderArticles(append = false) {
  const grid      = document.getElementById('articlesGrid');
  const headerEl  = document.getElementById('listHeader');
  const loadMoreW = document.getElementById('loadMoreWrap');
  if (!grid) return;

  const slice = filteredArticles.slice(displayedCount, displayedCount + PAGE_SIZE);
  displayedCount += slice.length;

  if (!append) {
    if (filteredArticles.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">📝</span>
          <h3>Belum ada artikel</h3>
          <p>Jadilah yang pertama menulis artikel!</p>
        </div>`;
      if (headerEl) headerEl.textContent = '0 artikel ditemukan';
      if (loadMoreW) loadMoreW.style.display = 'none';
      return;
    }
    grid.innerHTML = '';
    if (headerEl) headerEl.textContent = `${filteredArticles.length} artikel ditemukan`;
  }

  slice.forEach((article, idx) => {
    const card = buildArticleCard(article, idx);
    grid.appendChild(card);
  });

  const hasMore = displayedCount < filteredArticles.length;
  if (loadMoreW) loadMoreW.style.display = hasMore ? 'block' : 'none';
}

// ─────────────────────────────────────────────
// BUILD ARTICLE CARD
// ─────────────────────────────────────────────
function buildArticleCard(article, idx) {
  const card = document.createElement('div');
  card.className = 'article-card';
  card.style.animationDelay = `${idx * 0.05}s`;

  const dateStr   = new Date(article.created_at).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric'
  });

  const readTime  = estimateReadTime(article.content);
  const excerpt   = generateExcerpt(article.content, 120);
  const isOwner   = currentUser && currentUser.id === article.user_id;

  card.innerHTML = `
    <!-- Cover -->
    <div class="article-cover-wrap">
      ${article.cover_url
        ? `<img data-src="${escapeHtml(article.cover_url)}" alt="${escapeHtml(article.title)}" loading="lazy" />`
        : `<div class="no-cover">📝</div>`
      }
    </div>

    <!-- Body -->
    <div class="article-card-body">
      <div class="article-card-title">${escapeHtml(article.title)}</div>
      <div class="article-card-excerpt">${escapeHtml(excerpt)}</div>

      <div class="article-card-footer">
        <span class="article-author">@${escapeHtml(article.username)}</span>
        <span class="article-read-time">⏱ ${readTime}</span>
        <span class="article-date">${dateStr}</span>
        ${isOwner
          ? `<button class="btn-delete-article" data-id="${article.id}">🗑️</button>`
          : ''
        }
      </div>
    </div>
  `;

  // Lazy load cover
  const img = card.querySelector('img[data-src]');
  if (img) {
    img.onload  = () => img.classList.add('loaded');
    img.onerror = () => { img.remove(); };
    img.src = img.dataset.src;
  }

  // Klik card → buka detail
  card.addEventListener('click', (e) => {
    if (e.target.classList.contains('btn-delete-article')) return;
    window.location.href = `article-detail.html?id=${article.id}`;
  });

  // Delete
  if (isOwner) {
    card.querySelector('.btn-delete-article')
      ?.addEventListener('click', (e) => {
        e.stopPropagation();
        handleDeleteArticle(article.id, card);
      });
  }

  return card;
}

// ─────────────────────────────────────────────
// DELETE ARTIKEL
// ─────────────────────────────────────────────
async function handleDeleteArticle(articleId, cardEl) {
  if (!confirm('Hapus artikel ini? Tindakan ini tidak bisa dibatalkan.')) return;

  cardEl.style.opacity       = '0.4';
  cardEl.style.pointerEvents = 'none';

  try {
    const { error } = await supabase
      .from('articles')
      .delete()
      .eq('id', articleId)
      .eq('user_id', currentUser.id);

    if (error) throw error;

    cardEl.style.transition = 'all 0.3s ease';
    cardEl.style.transform  = 'scale(0.92)';
    cardEl.style.opacity    = '0';

    setTimeout(() => {
      cardEl.remove();
      allArticles = allArticles.filter(a => a.id !== articleId);
      const totalEl = document.getElementById('totalArticleCount');
      if (totalEl) totalEl.textContent = allArticles.length;
      applyFilters();
    }, 300);

  } catch (err) {
    console.error('[RPR Hub] Delete article error:', err);
    cardEl.style.opacity       = '1';
    cardEl.style.pointerEvents = 'auto';
    alert('Gagal menghapus artikel. Coba lagi.');
  }
}

// ─────────────────────────────────────────────
// LOAD MORE
// ─────────────────────────────────────────────
function initLoadMore() {
  document.getElementById('loadMoreBtn')
    ?.addEventListener('click', () => renderArticles(true));
}

// ════════════════════════════════════════════
// DETAIL PAGE
// ════════════════════════════════════════════

async function initDetailPage() {
  const wrapper = document.getElementById('detailWrapper');
  if (!wrapper) return;

  // Ambil ID dari URL: ?id=xxx
  const params    = new URLSearchParams(window.location.search);
  const articleId = params.get('id');

  if (!articleId) {
    renderNotFound(wrapper);
    return;
  }

  try {
    const { data: article, error } = await supabase
      .from('articles')
      .select('*')
      .eq('id', articleId)
      .single();

    if (error || !article) { renderNotFound(wrapper); return; }

    // Update page title
    document.title = `${article.title} — RPR Hub`;

    renderDetailPage(wrapper, article);

  } catch (err) {
    console.error('[RPR Hub] Load article detail error:', err);
    renderNotFound(wrapper);
  }
}

// ─────────────────────────────────────────────
// RENDER DETAIL PAGE
// ─────────────────────────────────────────────
function renderDetailPage(wrapper, article) {
  const dateStr   = new Date(article.created_at).toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  const readTime  = estimateReadTime(article.content);
  const isOwner   = currentUser && currentUser.id === article.user_id;
  const initials  = (article.username || 'U').substring(0, 2).toUpperCase();

  wrapper.innerHTML = `
    <!-- Back -->
    <a href="articles.html" class="detail-back">← Kembali ke Daftar Artikel</a>

    <!-- Cover Image -->
    ${article.cover_url
      ? `<img
           class="detail-cover"
           data-src="${escapeHtml(article.cover_url)}"
           alt="${escapeHtml(article.title)}"
         />`
      : ''
    }

    <!-- Header -->
    <div class="detail-header">
      <span class="detail-tag">📝 Artikel Komunitas</span>

      <h1 class="detail-title">${escapeHtml(article.title)}</h1>

      <div class="detail-meta">
        <div class="detail-author">
          <div class="author-avatar">${escapeHtml(initials)}</div>
          <div class="author-info">
            <div class="author-name">@${escapeHtml(article.username)}</div>
            <div class="author-label">Penulis</div>
          </div>
        </div>
        <span class="detail-date">📅 ${dateStr}</span>
        <span class="detail-read-time">⏱ ${readTime}</span>
      </div>
    </div>

    <!-- Content -->
    <div class="detail-content" id="detailContent"></div>

    <!-- Footer -->
    <div class="detail-footer">
      <a href="articles.html" class="btn-back-bottom">← Kembali ke Artikel</a>
      ${isOwner
        ? `<button class="btn-delete-detail" id="deleteDetailBtn">🗑️ Hapus Artikel</button>`
        : ''
      }
    </div>
  `;

  // Set content teks dengan aman
  const contentEl = document.getElementById('detailContent');
  if (contentEl) contentEl.textContent = article.content;

  // Lazy load cover
  const coverImg = wrapper.querySelector('img.detail-cover[data-src]');
  if (coverImg) {
    coverImg.onload  = () => coverImg.classList.add('loaded');
    coverImg.onerror = () => coverImg.remove();
    coverImg.src = coverImg.dataset.src;
  }

  // Delete dari halaman detail
  if (isOwner) {
    document.getElementById('deleteDetailBtn')
      ?.addEventListener('click', async () => {
        if (!confirm('Hapus artikel ini secara permanen?')) return;
        try {
          const { error } = await supabase
            .from('articles')
            .delete()
            .eq('id', article.id)
            .eq('user_id', currentUser.id);
          if (error) throw error;
          window.location.href = 'articles.html';
        } catch (err) {
          console.error('[RPR Hub] Delete detail error:', err);
          alert('Gagal menghapus. Coba lagi.');
        }
      });
  }
}

function renderNotFound(wrapper) {
  wrapper.innerHTML = `
    <div class="detail-not-found">
      <span class="not-found-icon">🔍</span>
      <h2>Artikel Tidak Ditemukan</h2>
      <p>Artikel yang kamu cari tidak ada atau sudah dihapus.</p>
      <a href="articles.html">← Kembali ke Daftar Artikel</a>
    </div>`;
}

// ─────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────

/** Estimasi waktu baca (rata-rata 200 kata/menit) */
function estimateReadTime(content) {
  if (!content) return '1 menit';
  const words   = content.trim().split(/\s+/).length;
  const minutes = Math.max(1, Math.ceil(words / 200));
  return `${minutes} menit`;
}

/** Potong teks jadi excerpt */
function generateExcerpt(content, maxLen = 120) {
  if (!content) return '';
  const clean = content.replace(/\n+/g, ' ').trim();
  return clean.length > maxLen ? clean.substring(0, maxLen) + '...' : clean;
}

/** XSS protection */
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