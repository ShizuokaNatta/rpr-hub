-- ══════════════════════════════════════════════
-- RPR Hub — FIXED RLS POLICIES
-- Jalankan sekali di SQL Editor Supabase
-- ══════════════════════════════════════════════

-- ── Hapus semua policy lama ──────────────────
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename IN ('reviews','maps','articles','profiles')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',
                   r.policyname, r.tablename);
  END LOOP;
END $$;

-- ── GRANT akses schema ke role anon ──────────
GRANT USAGE  ON SCHEMA public TO anon;
GRANT USAGE  ON SCHEMA public TO authenticated;
GRANT SELECT ON public.reviews  TO anon;
GRANT SELECT ON public.maps     TO anon;
GRANT SELECT ON public.articles TO anon;
GRANT SELECT ON public.profiles TO anon;
GRANT ALL    ON public.reviews  TO authenticated;
GRANT ALL    ON public.maps     TO authenticated;
GRANT ALL    ON public.articles TO authenticated;
GRANT ALL    ON public.profiles TO authenticated;

-- ── REVIEWS ──────────────────────────────────
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reviews_select_public"
  ON public.reviews FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "reviews_insert_auth"
  ON public.reviews FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "reviews_delete_own"
  ON public.reviews FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ── MAPS ─────────────────────────────────────
ALTER TABLE public.maps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "maps_select_public"
  ON public.maps FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "maps_insert_auth"
  ON public.maps FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "maps_delete_own"
  ON public.maps FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ── ARTICLES ─────────────────────────────────
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "articles_select_public"
  ON public.articles FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "articles_insert_auth"
  ON public.articles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "articles_delete_own"
  ON public.articles FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ── PROFILES ─────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_public"
  ON public.profiles FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- ── VERIFIKASI — hasil harus 11 baris ────────
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd;
```

---

=== DEBUGGING CHECKLIST ===

Setelah copy-paste kedua kode di atas, cek ini dalam **2 menit**:
```
□ 1. SQL dijalankan → query verifikasi di bawah return 11 baris policy

□ 2. Buka Supabase → Table Editor → reviews
     Klik tombol "RLS enabled" → pastikan hijau
     Klik "Policies" → ada "reviews_select_public" dengan role anon

□ 3. Test query langsung di SQL Editor:
     SET ROLE anon;
     SELECT * FROM public.reviews LIMIT 1;
     -- Harus return data, bukan error

□ 4. Buka browser → F12 → Console
     Cek apakah error masih ada
     Kalau masih error → baca field "code" yang sekarang tampil:
       code 42501 → RLS masih blokir → ulangi langkah SQL
       code 42P01 → nama tabel salah → cek ejaan di Table Editor
       "Failed to fetch" → SUPABASE_URL salah di supabase.js

□ 5. Pastikan di supabase.js:
     - SUPABASE_URL = https://xxxxx.supabase.co  (tanpa slash di akhir)
     - SUPABASE_ANON_KEY = key "anon public" (BUKAN service_role)