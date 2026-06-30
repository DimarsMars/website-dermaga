# Checklist Perbaikan — Dock Pre-Booking Monitoring System

> Tujuan: Siap produksi untuk Pelabuhan Benoa (Dermaga Timur).
> Centang `[x]` saat selesai. Setiap item mencantumkan file:baris & jenis perbaikan.

---

## P0 — CRITICAL (wajib sebelum deploy)

### P0.1 Perbaiki Migration Runner
- [ ] Ubah `server/src/database/migrate.js` agar menjalankan file SQL berurutan:
  - `migration.sql`
  - `add_ship_columns.sql`
  - `add_notif_booking_ref.sql`
  - `add_extend_columns.sql`
  - `add_completed_status.sql`
  - `seed.sql`
- [ ] Tambah tracking nama file yang sudah dijalankan ( tabel `schema_migrations` atau list manual dengan IF NOT EXISTS)
- [ ] Uji `npm run db:fresh` pada DB kosong → semua kolom & constraint ada

### P0.2 Tambah Migration Kolom `email` & `reset_token`
- [ ] Buat `add_auth_columns.sql`:
  - `ALTER TABLE master_petugas ADD COLUMN email VARCHAR(100)`
  - `ALTER TABLE master_petugas ADD COLUMN reset_token VARCHAR(64)`
  - `ALTER TABLE master_petugas ADD COLUMN reset_token_expires TIMESTAMP`
  - `ALTER TABLE master_agen ADD COLUMN reset_token VARCHAR(64)`
  - `ALTER TABLE master_agen ADD COLUMN reset_token_expires TIMESTAMP`
- [ ] Daftarkan di runner migrate.js
- [ ] Uji fitur Reset Password end-to-end pada DB fresh

### P0.3 Perbaiki Bug `manualBooking` Selamanya Pending
- [ ] `server/src/controllers/booking.controller.js:86` ubah `status_request` dari `'pending'` menjadi `'approved'`
- [ ] Pastikan booking manual langsung muncul di berthing plan approved
- [ ] Tambah notifikasi + activity log pada `manualBooking` (setara dengan `submitBooking`)

### P0.4 Tambah Ownership Check `extendBooking`
- [ ] `server/src/controllers/booking.controller.js:271` — sebelum proses extend, fetch booking & cek `booking.id_agen === req.user.id`
- [ ] Tolak dengan 403 jika bukan pemilik
- [ ] Tambah unit test: agen A tidak bisa extend booking agen B

### P0.5 Wajibkan reCAPTCHA pada Auth
- [ ] `server/src/controllers/auth.controller.js:56-64, 112-120` — hapus kondisional `if (recaptchaToken)`, selalu verifikasi
- [ ] Tolak request login/register tanpa `recaptchaToken` (400 — "reCAPTCHA token required")
- [ ] Di production: `RECAPTCHA_SECRET_KEY` wajib di-set, jika tidak server menolak start
- [ ] `verifyRecaptcha` (line 25-28) jangan return `true` saat secret kosong di production

### P0.6 Tambah Validasi Input Auth
- [ ] Buat Joi schema di `server/src/validations/auth.validation.js`:
  - `registerSchema`: username (3-50), password (min 8, kompleks), email valid, nama lengkap
  - `loginSchema`: username, password, recaptchaToken (wajib)
  - `createOfficerSchema` / `createAdminSchema`: sama + role
  - `resetPasswordSchema`: email valid
  - `confirmResetPasswordSchema`: token, newPassword (min 8)
  - `changePasswordSchema`: currentPassword, newPassword
- [ ] Pasang schema lewat middleware `validate(schema)` di `routes/auth.routes.js`

---

## P1 — HIGH (sebelum go-live)

### P1.1 Refresh Token Server-Side + Rotation
- [ ] Buat tabel `refresh_tokens` ( id, id_user, role, token_hash, expires_at, revoked_at, created_at )
- [ ] Saat login: hash refresh token & simpan di tabel
- [ ] Saat refresh: cek token ada & belum revoked & belum expired → rotasi (revoke lama, terbitkan baru)
- [ ] `auth.controller.js:635-681` implementasi rotasi proper
- [ ] `client/src/services/api.js:82-83` simpan JUGA `refreshToken` baru (bukan hanya accessToken)

### P1.2 Token Versioning (Invalidasi JWT saat Ganti Password)
- [ ] Tambah kolom `token_version INTEGER DEFAULT 0` di `master_petugas` & `master_agen`
- [ ] Sertakan `tokenVersion` di JWT payload (`auth.controller.js:11-19`)
- [ ] Saat `changePassword`: increment `token_version` → token lama invalid
- [ ] Middleware `authenticate` cek `token_version` match

### P1.3 Graceful Shutdown
- [ ] `server/src/index.js` — tambah handler `SIGTERM` & `SIGINT`:
  - `server.close()` (stop accept new conn)
  - `stopScheduler()` (clear interval)
  - `pool.end()` (close DB)
  - Timeout fallback force-exit 10s
- [ ] Uji: `docker stop` / `kill -TERM` → koneksi & transaksi selesai dulu

### P1.4 Dockerfile Produksi
- [ ] Buat `Dockerfile` multi-stage: build stage (install + vite build) → runtime stage (alpine + hanya dist + server + prod deps)
- [ ] Pisahkan `docker-compose.yml` (dev) vs `docker-compose.prod.yml` (build image, tanpa bind-mount)
- [ ] Healthcheck container di compose: `curl -f http://localhost:8080/healthz`

### P1.5 Hapus Secret Hardcode
- [ ] `docker-compose.yml:43-46` hapus `JWT_SECRET=change_me_in_production`, wajib via env/secrets
- [ ] Tambah validasi saat server start: tolak start jika `JWT_SECRET`/`JWT_REFRESH_SECRET` kosong atau masih placeholder

### P1.6 Pagination Endpoint List
- [ ] `booking.model.js:30-48` — tambah parameter `limit`, `offset`, `cursor`
- [ ] `notification.model.js:28-37`, `activity.model.js:57-104` — sama
- [ ] `ship.model.js`/`agent.model.js`/`officer.model.js` findAll — tambah limit default 100
- [ ] Controller parse `?page=1&limit=20` dari query
- [ ] Response sertakan `{ data, total, page, limit, hasMore }`
- [ ] Tambah index komposit: `(status_request, eta_in, etd_out)` & `trx_booking.id_kapal`

### P1.7 Global Error Handler
- [ ] `server/src/app.js` tambah di akhir:
  ```
  app.use((err, req, res, next) => {
    logger.error(err);
    res.status(err.status || 500).json({ success:false, error:{ code:'INTERNAL', message:'...' } });
  });
  ```
- [ ] Tangani error Joi validation → 400
- [ ] Tangani error JWT expired/invalid → 401
- [ ] Jangan bocorkan stack trace di production

---

## P2 — MEDIUM (reliabilitas & performance)

### P2.1 Race Condition TOCTOU
- [ ] `booking.service.js:151-163, 250-263, 430-436` — pindahkan pengecekan status ke DALAM transaksi
- [ ] Gunakan `SELECT ... FOR UPDATE` pada booking target
- [ ] Pastikan `approveBooking`/`rejectBooking`/`approveExtend`/`rejectExtend`/`editPosition` aman dari approve konkuren

### P2.2 Ownership Check Sebelum Mutasi Notifikasi
- [ ] `notification.controller.js:47-62` (markAsRead): cek ownership DULU, baru update
- [ ] `notification.controller.js:93-108` (delete): cek ownership DULU, baru delete
- [ ] Gunakan query: `UPDATE ... WHERE id_notif=$1 AND id_user=$2 AND role=$3 RETURNING *`; jika rowCount=0 → 403

### P2.3 Fix Header PDF Sebelum Generate
- [ ] `booking.controller.js:624-636` & `activity.controller.js:52-65` — pindahkan `Content-Type`/`Content-Disposition` SETELAH `generatePdf` berhasil
- [ ] Tangani error stream pada `pdfStream.on('error', ...)`

### P2.4 Scheduler Mutex & Dedup
- [ ] `scheduler.service.js:144-154` — tambah flag `isRunning`, skip tick jika masih jalan
- [ ] `scheduler.service.js:96-103` — dedup "extend offer" pakai `related_booking_id`, bukan `LIKE '%' || nama_kapal || '%'`

### P2.5 Fix Client Refresh Token Rotation
- [ ] `client/src/services/api.js:82-83` — simpan `refreshToken` baru hasil rotasi
- [ ] Sinkronkan dengan AuthContext agar state token konsisten

### P2.6 Fix BookingContext Auto-Fetch
- [ ] `client/src/context/BookingContext.jsx:27-32` — tambahkan state auth (token/user) ke effect deps
- [ ] Atau fetch setiap kali event `auth:login` dipancarkan

### P2.7 Lengkapkan `deleteBooking` & `manualBooking`
- [ ] `booking.controller.js:557-577` — tambah socket broadcast, activity log, notifikasi
- [ ] `booking.controller.js:74-114` — tambah socket broadcast, activity log, notifikasi (setara `submitBooking`)
- [ ] `booking.controller.js:560` — pindahkan ke `BookingService` (jangan langsung `pool.query`)

### P2.8 Eliminasi N+1 Query
- [ ] `scheduler.service.js:42-49, 70-77` — batch fetch `WHERE id_booking IN (...)`
- [ ] `notification.service.js:40-53, 168-184` — batch insert notifikasi
- [ ] `socket.service.js:35-43` — pakai `io.to(user:${id}:${role})` (room), bukan iterasi socket

### P2.9 Optimasi Socket.io Initial Emit
- [ ] `config/socket.js:42` — jangan kirim `findAll(null)` ke semua koneksi baru
- [ ] Emit data bookings hanya saat client subscribe/message explicit
- [ ] Atau paginasi data awal yang dikirim

### P2.10 Lazy Loading Route Client
- [ ] `client/src/App.jsx:6-21` — pakai `React.lazy()` + `Suspense` per page
- [ ] `client/vite.config.js` — tambah `build.rollupOptions.output.manualChunks` pisahkan react/axios/socket.io

### P2.11 Logger Terstruktur
- [ ] Install `pino` atau `winston`
- [ ] Ganti 73 `console.*` di `server/src` dengan logger
- [ ] Level per env (development=debug, production=info)
- [ ] Output JSON di production, pretty print di development
- [ ] Rotation file `logs/app.log` + `logs/error.log`

### P2.12 Request Logging & Size Limit
- [ ] Tambah `morgan` (atau pino-http) untuk HTTP request log
- [ ] `app.use(express.json({ limit: '1mb' }))` eksplisit

---

## P3 — LOW (kerapian & inkonsistensi)

### P3.1 Refactor Struktur Kode
- [ ] Pisahkan `auth.controller.js` (695 baris) → `auth.service.js` + `reset.service.js`
- [ ] Pisahkan `booking.service.js` (580 baris) → `booking.service.js` + `extend.service.js`
- [ ] Pisahkan HTML email (line 248-317) → `templates/resetPassword.html`
- [ ] Pindahkan `deleteBooking` ke `BookingService` (`booking.controller.js:560`)

### P3.2 Seragamkan Pola Validasi
- [ ] `master.controller.js:83,123,...` — pakai factory `validate(schema)` di route, bukan inline `schema.validate()`
- [ ] `shipCreateSchema` & `shipUpdateSchema` (`master.controller.js:10-28`) gabung jadi satu schema reusable

### P3.3 Hapus Dead Code
- [ ] `middleware/role.middleware.js:24-61` matriks `PERMISSIONS` — hapus atau implementasikan proper
- [ ] `README.md:213` hapus event `booking_conflict` yang tidak ada di kode
- [ ] `activity.model.js:26-50` cek apakah `findAll`/`findByUser` benar-benar dipakai

### P3.4 Rapikan Magic Number
- [ ] `auth.controller.js:377, 452` — pakai const `SALT_ROUNDS` (jangan literal `12`)
- [ ] `utils/pdf.js` — konstanta `PAGE_WIDTH`, `MARGIN`, dll
- [ ] `scheduler.service.js` — const `SCHEDULER_INTERVAL_MS`, `EXTEND_OFFER_WINDOW_HOURS`

### P3.5 Sinkronisasi Port Default
- [ ] `client/vite.config.js:10` proxy → samakan dengan `api.js:4` fallback (8080)
- [ ] `.env.example` root & `server/.env.example` samakan default (`DB_USER`, `DB_PASSWORD`)
- [ ] Dokumentasikan port mapping di README

### P3.6 Konsistensi Model Officer
- [ ] `officer.model.js:24-31` `findById` tambahkan select `email` (sama dengan `findAll`)

### P3.7 Transaksi Reject Operations
- [ ] `booking.service.js:237, 408` — bungkus `rejectBooking`/`rejectExtend` dalam transaksi meskipun single statement (konsistensi)

### P3.8 Hapus Komentar Usang
- [ ] `booking.service.js:299` update komentar sesuai implementasi (`extend_etd_out`, bukan JSON di keterangan)

### P3.9 Config Pool DB via Env
- [ ] `server/src/config/db.js:9-12` — baca `DB_POOL_MAX`, `DB_IDLE_TIMEOUT`, `DB_CONN_TIMEOUT` dari env

### P3.10 Perbaiki CORS Production
- [ ] `app.js:14` `origin: process.env.CLIENT_URL || 'http://localhost:5173'` — hapus fallback ke 5173 di production, atau set default ke domain prod

---

## SARAN PROFESIONAL TAMBAHAN (opsional untuk skripsi)

### Opsional A — Health Check Kaya
- [ ] Buat endpoint `GET /healthz`:
  - `db.ping` (SELECT 1)
  - `scheduler.lastRun`, `scheduler.isRunning`
  - `pool.totalCount`, `pool.idleCount`, `pool.waitingCount`
  - `uptime`, `memoryUsage`
- [ ] Docker/Compose healthcheck pakai endpoint ini

### Opsional B — CI/CD GitHub Actions
- [ ] `.github/workflows/ci.yml`:
  - job `test`: `npm run install:all`, `npm test`
  - job `build`: `npm run build`
  - job `lint` jika ada eslint config
- [ ] Boleh tambah job deploy ke server target

### Opsional C — Testing Coverage
- [ ] Aktifkan `jest --coverage` di `npm test`
- [ ] Set threshold coverage minimal (mis. 70% lines)
- [ ] Tambah integration test pakai testcontainers PostgreSQL (bukan pure mock)

### Opsional D — 2FA TOTP untuk Admin
- [ ] Tambah library `otplib`
- [ ] Endpoint `/api/auth/2fa/setup` (generate secret + QR)
- [ ] Endpoint `/api/auth/2fa/verify` (verifikasi kode)
- [ ] Wajib 2FA untuk role admin/petugas saat login

### Opsional E — Audit Log Retention & Backup
- [ ] Tambah job `cron`/`pg_cron` arsip `log_activity` > 1 tahun
- [ ] Dokumentasikan strategi backup `pg_dump` (retention 7/30 hari) + restore test berkala
- [ ] Tambah endpoint `/api/admin/backup` (khusus admin, jalanin pg_dump on-demand)

### Opsional F — Swagger/OpenAPI
- [ ] Install `swagger-jsdoc` + `swagger-ui-express`
- [ ] Annotasikan tiap route dengan `@openapi`
- [ ] Serve di `/api/docs`
- [ ] Fix inkonsistensi README (mis. `export/pdf` role)

### Opsional G — Rate Limiter Spesifik
- [ ] Turunkan auth limiter ke 5-10 attempt/15menit
- [ ] Tambah lockout: setelah 5 gagal, blok username 15 menit
- [ ] Limiter khusus `/reset-password` (3 req/jam)
- [ ] Limiter khusus POST `/bookings` (10 req/menit per agen)

---

## CATATAN DEPLOYMENT

### Sebelum go-live, pastikan:
1. Semua checklist **P0** selesai & teruji
2. Semua checklist **P1** selesai
3. HTTPS aktif (TLS termination via Nginx/Caddy reverse proxy)
4. `.env` production berisi secret kuat (32+ char random), BUKAN placeholder
5. Backup database terjadwal & restore test pernah dijalankan
6. Monitoring error (Sentry) terpasang
7. Runbook deploy/rollback tersedia

### Urutan eksekusi rekomendasi:
**P0 (1 minggu) → P1 (1-2 minggu) → P2 (paralel) → P3 (opsional) → Opsional A-G (jika waktu cukup)**

---

## STATUS

| Prioritas | Total Item | Selesai | Progres |
|-----------|------------|---------|---------|
| P0        | 6          | 0       | 0%      |
| P1        | 7          | 0       | 0%      |
| P2        | 12         | 0       | 0%      |
| P3        | 10         | 0       | 0%      |
| Opsional  | 7          | 0       | 0%      |