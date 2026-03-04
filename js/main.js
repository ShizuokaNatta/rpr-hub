// ============================================================
// main.js — RPR Hub (FIXED VERSION)
// ============================================================

import { supabase }     from './supabase.js';
import { updateNavbar } from './auth.js';

const FEED_LIMIT = 4;

// ─────────────────────────────────────────────
// ERROR LOGGER — selalu tampil detail di console
// ─────────────────────────────────────────────
function logErr(label, error) {
  console.error(`[RPR Hub] ${label}`, {
    message: error?.message  ?? '(no message)',
    code:    error?.code     ?? '(no code)',
    details: error?.details  ?? '(no details)',
    hint:    error?.hint     ?? '(no hint)',
    status:  error?.status   ?? '(no status)',
  });
}

// ─────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────
async function init() {
  initMobileMenu();
  await updateNavbar();
  await updateCTA();
  await Promise.all([
    loadFeedReviews(),
    loadFeedMaps(),
    loadFeedArticles(),
    loadHeroStats(),
  ]);
}

// ─────────────────────────────────────────────
// MOBILE MENU
// ─────────────────────────────────────────────
function initMobileMenu() {
  const btn  = document.getElementById('hamburgerBtn');
  const menu = document.getElementById('mobileMenu');
  if (!btn || !menu) return;

  btn.addEventListener('click', () => {
    const isOpen = menu.classList.toggle('open');
    btn.setAttribute('aria-expanded', String(isOpen));
    const spans = btn.querySelectorAll('span');
    if (isOpen) {
      spans[0].style.transform = 'translateY(7px) rotate(45deg)';
      spans[1].style.opacity   = '0';
      spans[2].style.transform = 'translateY(-7px) rotate(-45deg)';
    } else {
      spans.forEach(s => { s.style.transform = ''; s.style.opacity = ''; });
    }
  });

  document.addEventListener('click', e => {
    if (!menu.contains(e.target) && !btn.contains(e.target)) {
      menu.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
      btn.querySelectorAll('span').forEach(s => {
        s.style.transform = '';
        s.style.opacity   = '';
      });
    }
  });

  updateMobileAuth();
}

async function updateMobileAuth() {
  const mobileAuth = document.getElementById('mobileAuth');
  if (!mobileAuth) return;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', session.user.id)
    .maybeSingle();

  const username = profile?.username ?? session.user.email.split('@')[0];
  mobileAuth.innerHTML = `
    <span class="nav-username" style="flex:1;justify-content:center">
      👤 ${escapeHtml(username)}
    </span>
    <button class="nav-btn nav-btn--outline" id="mobileLogout" style="flex:0 0 auto">
      Keluar
    </button>`;

  document.getElementById('mobileLogout')?.addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = 'login.html';
  });
}

// ─────────────────────────────────────────────
// CTA — adaptif berdasarkan status login
// ─────────────────────────────────────────────
async function updateCTA() {
  const { data: { session } } = await supabase.auth.getSession();
  const ctaBanner  = document.getElementById('ctaBanner');
  const ctaActions = document.getElementById('ctaActions');
  const ctaTitle   = ctaBanner?.querySelector('.cta-title');
  const ctaDesc    = ctaBanner?.querySelector('.cta-desc');
  if (!ctaBanner) return;

  if (session) {
    if (ctaTitle) ctaTitle.innerHTML = 'Apa yang Kamu<br>Bagikan Hari Ini?';
    if (ctaDesc)  ctaDesc.textContent =
      'Kamu sudah login. Bagikan review, peta, atau tips untuk komunitas!';
    if (ctaActions) ctaActions.innerHTML = `
      <a href="reviews.html"  class="btn-cta-primary">⭐ Tulis Review</a>
      <a href="articles.html" class="btn-cta-secondary">📝 Tulis Artikel</a>`;
  }
}

// ─────────────────────────────────────────────
// HERO STATS — animasi angka
// ─────────────────────────────────────────────
async function loadHeroStats() {
  try {
    const [r, m, a] = await Promise.all([
      supabase.from('reviews' ).select('*', { count: 'exact', head: true }),
      supabase.from('maps'    ).select('*', { count: 'exact', head: true }),
      supabase.from('articles').select('*', { count: 'exact', head: true }),
    ]);

    // Log individual jika ada error
    if (r.error) logErr('Stats reviews:', r.error);
    if (m.error) logErr('Stats maps:',    m.error);
    if (a.error) logErr('Stats articles:', a.error);

    animateCount('statReviews',  r.count ?? 0);
    animateCount('statMaps',     m.count ?? 0);
    animateCount('statArticles', a.count ?? 0);

  } catch (err) {
    console.error('[RPR Hub] loadHeroStats exception:', err);
    ['statReviews','statMaps','statArticles'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = '0';
    });
  }
}

function animateCount(elId, target) {
  const el = document.getElementById(elId);
  if (!el) return;
  if (target === 0) { el.textContent = '0'; return; }
  const duration = 1200;
  const start    = performance.now();
  function step(now) {
    const p  = Math.min((now - start) / duration, 1);
    const e  = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(e * target);
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ─────────────────────────────────────────────
// FEED REVIEWS ← FIXED
// ─────────────────────────────────────────────
async function loadFeedReviews() {
  const grid = document.getElementById('feedReviews');
  if (!grid) return;

  try {
    const { data, error } = await supabase
      .from('reviews')
      .select('id, game_name, username, rating, content, created_at')
      .order('created_at', { ascending: false })
      .limit(FEED_LIMIT);

    if (error) {
      logErr('Feed reviews error:', error);
      grid.innerHTML = emptyHTML('⚠️', `Gagal memuat review: ${error.message}`);
      return;
    }

    grid.innerHTML = '';

    if (!data || data.length === 0) {
      grid.innerHTML = emptyHTML('⭐',
        'Belum ada review. <a href="reviews.html" style="color:var(--clr-accent)">Jadilah yang pertama!</a>');
      renderHeroPanel([]);
      return;
    }

    data.forEach((review, idx) => {
      const card = document.createElement('a');
      card.href      = 'reviews.html';
      card.className = 'feed-review-card';
      card.style.animationDelay = `${idx * 0.07}s`;

      const stars  = [1,2,3,4,5].map(n =>
        `<span class="${n <= review.rating ? 'on' : ''}">★</span>`).join('');
      const dateStr = fmtDate(review.created_at);

      card.innerHTML = `
        <div class="feed-review-game">${esc(review.game_name)}</div>
        <div class="feed-review-stars">${stars}</div>
        <div class="feed-review-text">${esc(review.content)}</div>
        <div class="feed-review-meta">
          <span class="author">@${esc(review.username)}</span>
          <span>${dateStr}</span>
        </div>`;

      grid.appendChild(card);
    });

    renderHeroPanel(data.slice(0, 3));

  } catch (err) {
    console.error('[RPR Hub] loadFeedReviews exception:', err);
    grid.innerHTML = emptyHTML('⚠️', 'Koneksi gagal. Refresh halaman.');
  }
}

// ─────────────────────────────────────────────
// HERO MINI PANEL
// ─────────────────────────────────────────────
function renderHeroPanel(reviews) {
  const panel = document.getElementById('heroPanelBody');
  if (!panel) return;

  if (!reviews.length) {
    panel.innerHTML = `
      <div class="mini-review" style="text-align:center;padding:20px">
        <span style="font-size:2rem;display:block;margin-bottom:8px">⭐</span>
        <span style="color:var(--clr-muted);font-size:0.82rem">
          Belum ada review.<br>Jadilah yang pertama!
        </span>
      </div>`;
    return;
  }

  panel.innerHTML = reviews.map((r, idx) => {
    const stars   = [1,2,3,4,5].map(n =>
      `<span class="${n <= r.rating ? 'on' : ''}">★</span>`).join('');
    const excerpt = (r.content || '').substring(0, 60) +
      (r.content?.length > 60 ? '...' : '');
    return `
      <div class="mini-review" style="animation-delay:${0.6 + idx * 0.15}s">
        <div class="mini-review-top">
          <span class="mini-review-game">${esc(r.game_name)}</span>
          <div class="mini-stars">${stars}</div>
        </div>
        <div class="mini-review-text">${esc(excerpt)}</div>
        <div class="mini-review-author">@${esc(r.username)}</div>
      </div>`;
  }).join('');
}

// ─────────────────────────────────────────────
// FEED MAPS ← FIXED
// ─────────────────────────────────────────────
async function loadFeedMaps() {
  const grid = document.getElementById('feedMaps');
  if (!grid) return;

  try {
    const { data, error } = await supabase
      .from('maps')
      .select('id, title, username, image_url, created_at')
      .order('created_at', { ascending: false })
      .limit(FEED_LIMIT);

    if (error) {
      logErr('Feed maps error:', error);
      grid.innerHTML = emptyHTML('⚠️', `Gagal memuat peta: ${error.message}`);
      return;
    }

    grid.innerHTML = '';

    if (!data || data.length === 0) {
      grid.innerHTML = emptyHTML('🗺️',
        'Belum ada peta. <a href="maps.html" style="color:var(--clr-accent4)">Upload petamu!</a>');
      return;
    }

    data.forEach((map, idx) => {
      const card = document.createElement('a');
      card.href      = 'maps.html';
      card.className = 'feed-map-card';
      card.style.animationDelay = `${idx * 0.07}s`;

      card.innerHTML = `
        <div class="feed-map-img">
          ${map.image_url
            ? `<img data-src="${esc(map.image_url)}" alt="${esc(map.title)}" loading="lazy" />`
            : `<div class="no-img">🗺️</div>`
          }
        </div>
        <div class="feed-map-body">
          <div class="feed-map-title">${esc(map.title)}</div>
          <div class="feed-map-author">@${esc(map.username)}</div>
        </div>`;

      lazyImg(card);
      grid.appendChild(card);
    });

  } catch (err) {
    console.error('[RPR Hub] loadFeedMaps exception:', err);
    grid.innerHTML = emptyHTML('⚠️', 'Koneksi gagal. Refresh halaman.');
  }
}

// ─────────────────────────────────────────────
// FEED ARTICLES ← FIXED
// ─────────────────────────────────────────────
async function loadFeedArticles() {
  const grid = document.getElementById('feedArticles');
  if (!grid) return;

  try {
    const { data, error } = await supabase
      .from('articles')
      .select('id, title, username, content, cover_url, created_at')
      .order('created_at', { ascending: false })
      .limit(FEED_LIMIT);

    if (error) {
      logErr('Feed articles error:', error);
      grid.innerHTML = emptyHTML('⚠️', `Gagal memuat artikel: ${error.message}`);
      return;
    }

    grid.innerHTML = '';

    if (!data || data.length === 0) {
      grid.innerHTML = emptyHTML('📝',
        'Belum ada artikel. <a href="articles.html" style="color:var(--clr-accent5)">Tulis artikel!</a>');
      return;
    }

    data.forEach((article, idx) => {
      const card = document.createElement('a');
      card.href      = `article-detail.html?id=${article.id}`;
      card.className = 'feed-article-card';
      card.style.animationDelay = `${idx * 0.07}s`;

      const content  = article.content ?? '';
      const excerpt  = content.replace(/\n+/g, ' ').substring(0, 80) +
        (content.length > 80 ? '...' : '');
      const readTime = Math.max(1, Math.ceil(content.split(/\s+/).length / 200));
      const dateStr  = fmtDate(article.created_at, true);

      card.innerHTML = `
        <div class="feed-article-cover">
          ${article.cover_url
            ? `<img data-src="${esc(article.cover_url)}" alt="${esc(article.title)}" loading="lazy" />`
            : `<div class="no-cover">📝</div>`
          }
        </div>
        <div class="feed-article-body">
          <div class="feed-article-title">${esc(article.title)}</div>
          <div class="feed-article-excerpt">${esc(excerpt)}</div>
          <div class="feed-article-meta">
            <span class="author">@${esc(article.username)}</span>
            <span class="read-time">⏱ ${readTime} menit · ${dateStr}</span>
          </div>
        </div>`;

      lazyImg(card);
      grid.appendChild(card);
    });

  } catch (err) {
    console.error('[RPR Hub] loadFeedArticles exception:', err);
    grid.innerHTML = emptyHTML('⚠️', 'Koneksi gagal. Refresh halaman.');
  }
}

// ─────────────────────────────────────────────
// SHARED UTILS
// ─────────────────────────────────────────────

/** XSS escape */
function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

/** Format tanggal */
function fmtDate(iso, short = false) {
  return new Date(iso).toLocaleDateString('id-ID', short
    ? { day: 'numeric', month: 'short' }
    : { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Empty / error state HTML */
function emptyHTML(icon, msg) {
  return `<div class="feed-empty"><span class="empty-icon">${icon}</span>${msg}</div>`;
}

/** Lazy load img[data-src] di dalam elemen */
function lazyImg(parent) {
  const img = parent.querySelector('img[data-src]');
  if (!img) return;
  img.onload  = () => img.classList.add('loaded');
  img.onerror = () => img.remove();
  img.src = img.dataset.src;
}

// ─────────────────────────────────────────────
// START
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => init());