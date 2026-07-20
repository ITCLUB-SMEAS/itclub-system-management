# ITCLUB Ekskul Management System — Product Requirements & Agent Context

## 1. Project Overview

ITCLUB Ekskul Management System adalah platform internal untuk mengelola operasional ekstrakurikuler IT Club (ITCLUB) di sekolah. Sistem ini menangani keanggotaan, presensi, project/tugas, event & prestasi, keuangan kas, hingga rekrutmen anggota baru — dalam satu platform terintegrasi.

Project ini **terpisah** dari situs publik ekskul yang sudah ada (clubit.id) dan tidak melakukan integrasi dengan sistem tersebut pada fase ini.

## 2. Target Users & Roles

Sistem ini hanya melayani internal ekskul — **tidak ada akses** untuk pembina/guru pendamping atau pihak sekolah (kepsek/TU) pada scope saat ini.

| Role | Deskripsi |
|---|---|
| Anggota | Member biasa ekskul |
| Pengurus — Ketua | Full access, approval tertinggi |
| Pengurus — Wakil Ketua | Mirror akses Ketua (minus beberapa approval sensitif) |
| Pengurus — Sekretaris | Kelola administrasi, dokumentasi, presensi |
| Pengurus — Bendahara | Akses modul keuangan |
| Pengurus — Kepala Divisi | Kelola anggota & tugas dalam divisinya |

## 3. Tech Stack

- **Backend / API**: NestJS
- **ORM**: Prisma
- **Database**: PostgreSQL
- **Web Frontend**: Astro (SSG untuk halaman statis/konten, islands architecture — React/Vue island — untuk bagian interaktif seperti dashboard, kanban, form)
- **Mobile App (companion, direncanakan)**: Flutter, mengonsumsi API backend yang sama dengan web
- Backend didesain **API-first** supaya bisa dipakai bersama oleh web dan mobile app tanpa duplikasi logic

## 4. Scope & Release Strategy

Keputusan produk: **full all-in-one dari rilis pertama** — bukan MVP yang dipangkas fitur. Urutan pembangunan (development sequence) tetap disarankan bertahap secara teknis — lihat Section 8 — supaya fondasi modul dasar selesai duluan.

## 5. Feature Modules (Functional Requirements)

### 5.1 Membership & Organisasi
- Registrasi anggota baru dengan approval flow (pending → approved/rejected)
- Profil anggota (data diri, kelas/angkatan, minat & skill)
- Struktur organisasi & role hierarchy per divisi
- Status keanggotaan (aktif/alumni/non-aktif) + histori per periode kepengurusan

### 5.2 Presensi & Kegiatan
- Jadwal kegiatan rutin + kalender
- Presensi via QR code scan (web manual / mobile native camera) + opsional geofencing
- Rekap kehadiran per anggota
- Reminder notifikasi H-1 kegiatan

### 5.3 Manajemen Project & Tugas
- Kanban board (To Do / In Progress / Review / Done)
- Assignment tugas ke anggota atau divisi
- Submission (link repo/file/demo)
- Review & feedback dari pengurus/mentor
- Mentor-mentee pairing senior-junior

### 5.4 Event, Kompetisi & Prestasi
- Kalender lomba/workshop internal & eksternal
- Pendaftaran anggota ke event
- Tracking hasil lomba sebagai portfolio ekskul
- Galeri dokumentasi kegiatan

### 5.5 Keuangan Kas Ekskul
- Pencatatan kas masuk-keluar (iuran, dana kegiatan)
- Laporan keuangan per periode, exportable

### 5.6 Komunikasi & Notifikasi
- Announcement board internal
- Notifikasi (email/in-app/push) untuk deadline, kegiatan, approval

### 5.7 Achievement & Gamifikasi
- Badge/poin berdasarkan kehadiran, project, kontribusi
- Leaderboard divisi/individu
- Sertifikat digital otomatis (generate PDF) berdasarkan syarat tertentu

### 5.8 Auth & RBAC
- Role-based access control per role di Section 2
- Login email/username (tanpa SSO sekolah)
- Biometric login di mobile app

### 5.9 Learning & Knowledge Base
- Repository materi belajar per topik/divisi
- Learning path/roadmap berjenjang junior → senior
- Arsip rekaman sesi pelatihan internal

### 5.10 Rekrutmen Anggota Baru (PSB Ekskul)
- Alur seleksi multi-tahap (form → tes/interview → pengumuman)
- Kuisioner minat/bakat untuk penempatan divisi
- Onboarding checklist anggota baru

### 5.11 Pemilu & Voting Internal
- Voting pemilihan ketua/pengurus baru
- Polling keputusan internal

### 5.12 Peminjaman Inventaris
- Peminjaman alat (laptop, proyektor, mic) untuk kegiatan/lomba
- Tracking aset ekskul

### 5.13 Portfolio Publik Otomatis
- Halaman portfolio publik per anggota (auto-generate dari data project + prestasi), dioptimalkan lewat Astro SSG
- Showcase page ekskul untuk promosi ke calon anggota baru

### 5.14 Integrasi Eksternal
- GitHub integration (auto-pull commit activity dari repo yang di-submit)
- Bot notifikasi Discord/WhatsApp
- Sync kalender kegiatan ke Google Calendar

### 5.15 Evaluasi & Feedback
- Evaluasi kinerja pengurus tiap akhir periode (feedback dari anggota)
- Peer review antar anggota untuk project kelompok

### 5.16 Historical Archive
- Data tersimpan terpisah per tahun kepengurusan
- Laporan tren (pertumbuhan anggota, jumlah prestasi) antar periode

### 5.17 Mobile App — Fitur Spesifik (Flutter)
- Presensi QR scan native + geofencing
- Push notification real-time (FCM)
- Submission tugas cepat via kamera/share sheet
- Materi belajar offline (download PDF/video)
- Portfolio & achievement sharing ke medsos
- Kalender & RSVP event + sync kalender native
- Voting/polling
- Direktori anggota

> **Catatan pembagian platform**: modul manajemen data berat (laporan keuangan detail, struktur organisasi, kanban board penuh) tetap primary di web dashboard. Approval simpel (approve anggota baru, approve submission tugas) tersedia sebagai quick action di mobile app.

## 6. Data Model — Entitas Utama (high-level, referensi untuk Prisma schema)

- `User` (auth), `Member` (profil anggota), `Role`, `Division`, `MembershipPeriod`
- `Attendance`, `Event`, `EventRegistration`
- `Project`, `Task`, `Submission`, `Feedback`
- `Transaction` (keuangan), `FinancialReport`
- `Announcement`, `Notification`
- `Badge`, `Achievement`, `Certificate`
- `LearningResource`, `LearningPath`
- `RecruitmentApplication`
- `Election`, `Vote`, `Poll`
- `InventoryItem`, `InventoryLoan`
- `Evaluation`, `PeerReview`

## 7. Non-Functional Requirements

- RBAC ketat per role, terutama modul keuangan (Bendahara only) dan approval (Pengurus only)
- Data anggota (termasuk data siswa di bawah umur) memerlukan perhatian khusus soal privasi & retensi data
- Backup rutin database (PostgreSQL)
- Hosting fleksibel, Docker/Kubernetes-ready

## 8. Suggested Build Order (Development Sequence)

1. Auth + Membership + Struktur Organisasi (fondasi)
2. Presensi & Kegiatan
3. Project & Tugas
4. Event & Prestasi
5. Keuangan + Achievement/Gamifikasi
6. Learning & Knowledge Base + Rekrutmen
7. Pemilu/Voting + Peminjaman Inventaris + Integrasi Eksternal
8. Mobile App (Flutter) — setelah API backend modul inti stabil

## 9. Out of Scope (Fase Ini)

- Akses untuk pembina/guru pendamping dan pihak sekolah (kepsek/TU)
- Integrasi dengan situs clubit.id yang sudah ada
- SSO dengan sistem sekolah

## 10. Notes for AI Coding Agents

- Ikuti struktur modular NestJS (`src/modules/<domain>`) — satu module per domain di Section 5
- Schema Prisma **single source**: `api/prisma/schema.prisma` (root `schema.prisma` = symlink). Migration: `cd api && npx prisma migrate dev`
- Secrets: `JWT_SECRET` + `JWT_REFRESH_SECRET` min 32 chars, bukan placeholder; production boot gagal jika lemah
- Audit log (`AuditLog`) untuk aksi sensitif: auth, member approve/reject, finance, recruitment, vote
- Astro pages untuk konten statis/SSG; gunakan island (React/Vue) hanya untuk bagian yang butuh interaktivitas (dashboard, kanban, form dinamis)
- Semua endpoint API harus tervalidasi RBAC sesuai role di Section 2 sebelum implementasi fitur baru
- Jangan implementasikan fitur yang masuk kategori "Out of Scope" (Section 9) kecuali ada instruksi eksplisit baru
