# RPR Hub — Rutinitas Player Roblox

Website komunitas resmi Roblox berbahasa Indonesia.

## Setup Awal

### 1. Konfigurasi Supabase
1. Buka [supabase.com](https://supabase.com) → buat project baru
2. Pergi ke **Settings → API**
3. Copy **Project URL** dan **anon public key**
4. Buka `/js/supabase.js` dan isi kedua nilai tersebut

### 2. Buat Tabel Database
1. Di dashboard Supabase, buka **SQL Editor**
2. Klik **New Query**
3. Copy-paste seluruh isi `/js/supabase-schema.sql`
4. Klik **Run**

### 3. Aktifkan Email Auth
1. Supabase → **Authentication → Providers**
2. Pastikan **Email** provider aktif
3. (Opsional) Matikan "Confirm email" untuk testing lokal

### 4. Deploy ke Vercel
```bash
npm i -g vercel
vercel --prod
```

## Struktur Folder
```
/public   → Halaman HTML
/css      → Stylesheet per modul
/js       → JavaScript per modul
```

## Menambah Fitur Baru
Cukup tambahkan:
- `/public/fitur-baru.html`
- `/css/fitur-baru.css`
- `/js/fitur-baru.js`
- Tambah tabel baru di Supabase SQL Editor