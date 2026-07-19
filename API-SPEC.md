# API Endpoint Specification — ITCLUB Ekskul Management System

Base URL: `/api/v1`

**Konvensi umum:**
- Semua endpoint (kecuali disebutkan *public*) butuh JWT Bearer token
- Response format standar: `{ data, message, error }`
- Role check dijalankan lewat NestJS Guard (`RolesGuard`) sesuai role di PRD Section 2
- Endpoint mobile (Flutter) memakai API yang sama persis dengan web, kecuali disebutkan khusus di Section 17

---

## Auth (`/auth`)
| Method | Path | Deskripsi | Role |
|---|---|---|---|
| POST | /auth/register | Registrasi anggota baru (submit ke approval) | Public |
| POST | /auth/login | Login, return JWT | Public |
| POST | /auth/refresh | Refresh access token | Authenticated |
| POST | /auth/logout | Logout, invalidate refresh token | Authenticated |
| POST | /auth/biometric-login | Login via biometric token (mobile) | Authenticated |
| POST | /auth/device-token | Register FCM device token | Authenticated |

## 1. Membership & Organisasi (`/members`, `/divisions`, `/periods`)
| Method | Path | Deskripsi | Role |
|---|---|---|---|
| GET | /members | List anggota (filter: status, division, period) | Pengurus |
| GET | /members/:id | Detail profil anggota | Authenticated |
| PATCH | /members/:id | Update profil (self atau Pengurus) | Self / Pengurus |
| POST | /members/:id/approve | Approve pendaftaran | Ketua, Sekretaris |
| POST | /members/:id/reject | Reject pendaftaran | Ketua, Sekretaris |
| GET | /divisions | List divisi | Authenticated |
| POST | /divisions | Buat divisi baru | Ketua |
| POST | /members/:id/assign-division | Assign anggota ke divisi & role | Ketua, Kepala Divisi |
| GET | /periods | List periode kepengurusan | Authenticated |
| POST | /periods | Buat periode kepengurusan baru | Ketua |
| GET | /periods/:id/members | Anggota per periode | Pengurus |

## 2. Presensi & Kegiatan (`/activities`, `/attendances`)
| Method | Path | Deskripsi | Role |
|---|---|---|---|
| GET | /activities | List jadwal kegiatan | Authenticated |
| POST | /activities | Buat jadwal kegiatan | Pengurus |
| POST | /attendances/check-in | Presensi via QR scan / manual | Authenticated |
| GET | /attendances/me | Riwayat kehadiran sendiri | Authenticated |
| GET | /activities/:id/attendances | Rekap kehadiran per kegiatan | Pengurus |

## 3. Manajemen Project & Tugas (`/projects`, `/tasks`, `/submissions`, `/mentor-assignments`)
| Method | Path | Deskripsi | Role |
|---|---|---|---|
| GET | /projects | List project | Authenticated |
| POST | /projects | Buat project baru | Pengurus, Kepala Divisi |
| GET | /projects/:id/tasks | List tugas dalam project | Authenticated |
| POST | /tasks | Buat tugas baru | Pengurus, Kepala Divisi |
| PATCH | /tasks/:id/status | Update status kanban (todo/in-progress/review/done) | Assignee, Pengurus |
| POST | /tasks/:id/assign | Assign tugas ke anggota | Pengurus, Kepala Divisi |
| POST | /tasks/:id/submissions | Submit tugas (repo/file/demo link) | Assignee |
| GET | /submissions/:id | Detail submission | Authenticated |
| POST | /submissions/:id/feedback | Beri feedback ke submission | Pengurus, Mentor |
| POST | /mentor-assignments | Pasangkan mentor-mentee | Kepala Divisi |
| GET | /mentor-assignments/me | Lihat mentor/mentee sendiri | Authenticated |

## 4. Event, Kompetisi & Prestasi (`/events`, `/gallery`)
| Method | Path | Deskripsi | Role |
|---|---|---|---|
| GET | /events | List event/lomba/workshop | Authenticated |
| POST | /events | Buat event baru | Pengurus |
| POST | /events/:id/register | Daftar ke event | Authenticated |
| GET | /events/:id/registrations | List pendaftar event | Pengurus |
| POST | /events/:id/achievements | Catat hasil/prestasi lomba | Pengurus |
| POST | /events/:id/gallery | Upload dokumentasi kegiatan | Pengurus |
| GET | /gallery | List galeri dokumentasi | Authenticated |

## 5. Keuangan Kas Ekskul (`/transactions`)
| Method | Path | Deskripsi | Role |
|---|---|---|---|
| GET | /transactions | List transaksi kas | Bendahara, Ketua |
| POST | /transactions | Catat transaksi masuk/keluar | Bendahara |
| GET | /transactions/report?periodId= | Laporan keuangan per periode | Bendahara, Ketua |

## 6. Komunikasi & Notifikasi (`/announcements`, `/notifications`)
| Method | Path | Deskripsi | Role |
|---|---|---|---|
| GET | /announcements | List pengumuman | Authenticated |
| POST | /announcements | Buat pengumuman | Pengurus |
| GET | /notifications/me | List notifikasi sendiri | Authenticated |
| PATCH | /notifications/:id/read | Tandai notifikasi sudah dibaca | Authenticated |

## 7. Achievement & Gamifikasi (`/badges`, `/certificates`, `/leaderboard`)
| Method | Path | Deskripsi | Role |
|---|---|---|---|
| GET | /badges | List badge yang tersedia | Authenticated |
| POST | /badges | Buat badge baru | Ketua |
| POST | /members/:id/badges | Award badge ke anggota | Pengurus |
| GET | /leaderboard | Leaderboard divisi/individu | Authenticated |
| POST | /certificates/generate | Generate sertifikat digital (PDF) | Pengurus |
| GET | /members/:id/certificates | List sertifikat milik anggota | Authenticated |

## 8. Auth & RBAC
Sudah tercakup di section **Auth** di atas, ditambah guard `RolesGuard` yang mengecek role dari `MemberPeriod.role` pada tiap request.

## 9. Learning & Knowledge Base (`/learning-resources`, `/learning-paths`)
| Method | Path | Deskripsi | Role |
|---|---|---|---|
| GET | /learning-paths | List learning path per divisi/level | Authenticated |
| POST | /learning-paths | Buat learning path baru | Kepala Divisi |
| GET | /learning-resources?divisionId=&pathId= | List materi belajar | Authenticated |
| POST | /learning-resources | Upload/tambah materi belajar | Kepala Divisi, Pengurus |
| GET | /learning-resources/:id/download | Signed URL untuk download/offline cache (mobile) | Authenticated |

## 10. Rekrutmen Anggota Baru (`/recruitment`)
| Method | Path | Deskripsi | Role |
|---|---|---|---|
| POST | /recruitment/apply | Form pendaftaran calon anggota | Public |
| GET | /recruitment | List pendaftar (calon anggota) | Pengurus |
| POST | /recruitment/:id/approve | Approve pendaftar, buat akun anggota | Pengurus |
| POST | /recruitment/:id/reject | Reject pendaftar | Pengurus |

## 11. Pemilu & Voting Internal (`/elections`, `/polls`)
| Method | Path | Deskripsi | Role |
|---|---|---|---|
| GET | /elections | List pemilu | Authenticated |
| POST | /elections | Buat pemilu baru | Ketua |
| POST | /elections/:id/candidates | Tambah kandidat | Ketua |
| POST | /elections/:id/vote | Voting | Authenticated |
| GET | /elections/:id/results | Hasil pemilu | Pengurus |
| GET | /polls | List polling internal | Authenticated |
| POST | /polls | Buat polling baru | Pengurus |
| POST | /polls/:id/vote | Vote polling | Authenticated |

## 12. Peminjaman Inventaris (`/inventory`, `/inventory-loans`)
| Method | Path | Deskripsi | Role |
|---|---|---|---|
| GET | /inventory | List aset ekskul | Authenticated |
| POST | /inventory | Tambah aset baru | Pengurus |
| POST | /inventory/:id/loan-request | Ajukan peminjaman | Authenticated |
| POST | /inventory-loans/:id/approve | Approve peminjaman | Pengurus |
| POST | /inventory-loans/:id/return | Catat pengembalian barang | Pengurus |

## 13. Portfolio Publik Otomatis (`/portfolio`)
| Method | Path | Deskripsi | Role |
|---|---|---|---|
| GET | /portfolio/:memberId | Halaman portfolio publik anggota | Public |
| GET | /portfolio/showcase | Showcase page ekskul (promosi) | Public |

## 14. Integrasi Eksternal (`/integrations`)
| Method | Path | Deskripsi | Role |
|---|---|---|---|
| POST | /integrations/github/webhook | Terima event commit dari repo yang di-submit | Service (webhook secret) |
| POST | /integrations/discord/notify | Trigger notifikasi ke bot Discord/WhatsApp | Internal service |
| GET | /integrations/calendar/sync.ics | Export kalender kegiatan (format iCal) | Authenticated |

## 15. Evaluasi & Feedback (`/evaluations`, `/peer-reviews`)
| Method | Path | Deskripsi | Role |
|---|---|---|---|
| POST | /evaluations | Beri evaluasi kinerja pengurus | Authenticated |
| GET | /evaluations/summary?periodId= | Ringkasan hasil evaluasi per periode | Ketua |
| POST | /peer-reviews | Beri peer review ke sesama anggota | Authenticated |
| GET | /peer-reviews/:memberId | List peer review yang diterima anggota | Authenticated |

## 16. Historical Archive (`/periods`)
| Method | Path | Deskripsi | Role |
|---|---|---|---|
| GET | /periods/:id/report | Laporan tren periode (pertumbuhan anggota, prestasi) | Pengurus |

## 17. Mobile App — Endpoint Tambahan
Konsumsi seluruh endpoint di atas via API yang sama. Tambahan khusus mobile:
| Method | Path | Deskripsi |
|---|---|---|
| POST | /auth/biometric-login | Login pakai fingerprint/face (token device tersimpan lokal) |
| POST | /auth/device-token | Registrasi token FCM untuk push notification |
| GET | /learning-resources/:id/download | Signed URL untuk caching offline |

---

## Catatan Implementasi NestJS
- Setiap module di atas jadi satu NestJS module: `AuthModule`, `MembersModule`, `AttendanceModule`, `ProjectsModule`, `EventsModule`, `FinanceModule`, `CommunicationModule`, `GamificationModule`, `LearningModule`, `RecruitmentModule`, `ElectionModule`, `InventoryModule`, `PortfolioModule`, `IntegrationsModule`, `EvaluationModule`.
- Gunakan `@UseGuards(JwtAuthGuard, RolesGuard)` + custom decorator `@Roles(RoleName.KETUA, ...)` di controller level.
- Endpoint publik (`/auth/register`, `/recruitment/apply`, `/portfolio/*`) di-exclude dari `JwtAuthGuard` lewat decorator `@Public()`.
