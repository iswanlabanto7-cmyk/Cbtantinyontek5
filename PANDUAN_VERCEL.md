# Panduan Publikasi Aplikasi EXAMCBT ke Vercel

Aplikasi ini telah siap dan terkonfigurasi secara penuh untuk dipublikasikan langsung ke **Vercel** (`vercel.com`).

---

## 1. Konfigurasi Vercel yang Telah Diterapkan

File `vercel.json` sudah disiapkan dengan konfigurasi:
- **Framework Preset**: `vite`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Routing SPA & API**: Semua routing halaman (`/*`) diarahkan ke `index.html` dan endpoint API (`/api/*`) diarahkan ke Vercel Serverless Function (`/api/index.ts`).

---

## 2. Langkah-Langkah Deploy ke Vercel

### Langkah 1: Unggah Proyek ke GitHub
1. Buat repository baru di GitHub (misal: `examcbt-admin`).
2. Push seluruh berkas kode ke repository GitHub Anda:
   ```bash
   git init
   git add .
   git commit -m "Siap deploy ke Vercel"
   git branch -M main
   git remote add origin https://github.com/USERNAME/examcbt-admin.git
   git push -u origin main
   ```

### Langkah 2: Import Proyek di Vercel
1. Buka [https://vercel.com](https://vercel.com) dan login (bisa login dengan akun GitHub).
2. Klik tombol **"Add New..."** lalu pilih **"Project"**.
3. Pilih repository GitHub Anda (`examcbt-admin`) dan klik **"Import"**.

### Langkah 3: Pengaturan Build & Environment Variables
1. **Framework Preset**: Vercel akan otomatis mendeteksi **Vite**.
2. **Build and Output Settings**:
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`
3. **Environment Variables**:
   Buka bagian **Environment Variables** dan tambahkan variabel berikut (bisa langsung copy dari file `.env.example`):

| Variable Name | Nilai / Value |
|---|---|
| `VITE_FIREBASE_API_KEY` | `AIzaSyAdn0t0bbCHQcFs6iq46CahhYeOkxWX2RU` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `gen-lang-client-0033732795.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | `gen-lang-client-0033732795` |
| `VITE_FIREBASE_DATABASE_ID` | `ai-studio-adminujianpanelk-60c1203c-881f-4c26-b3f9-e8dd8fcfcc25` |
| `VITE_FIREBASE_STORAGE_BUCKET` | `gen-lang-client-0033732795.firebasestorage.app` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `43846550676` |
| `VITE_FIREBASE_APP_ID` | `1:43846550676:web:b9bf5937cb20a11aee2081` |
| `GEMINI_API_KEY` | *(API key Gemini Anda jika ingin menggunakan fitur Asisten AI Tata Tertib)* |

> **Catatan**: Jika file `firebase-applet-config.json` diikutsertakan di repository, sistem akan otomatis membaca konfigurasinya sekalipun Anda belum mengisi Environment Variables. Namun mengisi di Vercel sangat disarankan untuk keamanan produksi.

### Langkah 4: Klik "Deploy"
1. Klik tombol **"Deploy"**.
2. Tunggu sekitar 1 menit hingga proses build selesai.
3. Vercel akan memberikan domain aktif, misalnya: `https://examcbt-admin.vercel.app`.

---

## 3. Menambahkan Domain Vercel ke Firebase Authorized Domains (PENTING)

Agar fitur **Login dengan Akun Google** dapat berfungsi di domain Vercel Anda tanpa error `auth/unauthorized-domain`:
1. Buka [Firebase Console](https://console.firebase.google.com/).
2. Pilih project `gen-lang-client-0033732795`.
3. Klik menu **Build** > **Authentication** > tab **Settings** > **Authorized domains**.
4. Klik **Add domain** dan masukkan nama domain Vercel Anda (misalnya: `examcbt-admin.vercel.app`).
5. Klik **Save**.
