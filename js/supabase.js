// ============================================================
// supabase.js — RPR Hub
// Inisialisasi Supabase Client
//
// CARA SETUP:
// 1. Buka https://supabase.com dan login ke dashboard kamu
// 2. Pilih project kamu (atau buat baru)
// 3. Pergi ke: Settings → API
// 4. Copy nilai berikut:
//    - "Project URL"  → ganti nilai SUPABASE_URL di bawah
//    - "anon public"  → ganti nilai SUPABASE_ANON_KEY di bawah
// 5. JANGAN share file ini ke publik jika sudah diisi key asli
//    (gunakan .env jika project berkembang)
// ============================================================

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// ─────────────────────────────────────────────
// ⚠️  GANTI DUA NILAI INI DENGAN MILIKMU
// ─────────────────────────────────────────────
const SUPABASE_URL      = 'https://pouzhrrmqhehwjfeebcv.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_J8NfbC2PZutaufDJny3r7A_0li5uv0M';
// ─────────────────────────────────────────────

if (SUPABASE_URL.includes('XXXXXXX') || SUPABASE_ANON_KEY.includes('XXXXXXX')) {
  console.error(
    '[RPR Hub] ⚠️  Supabase belum dikonfigurasi!\n' +
    'Buka /js/supabase.js dan isi SUPABASE_URL serta SUPABASE_ANON_KEY.'
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);