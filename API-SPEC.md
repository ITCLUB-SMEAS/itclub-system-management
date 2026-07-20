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
| GET | /activities/:id | Detail kegiatan | Authenticated |
| POST | /activities | Buat jadwal (opsional lat/lng + geofenceRadiusM) | Pengurus |
| POST | /activities/:id/rotate-qr | Rotate QR token + set TTL (default 15m) | Pengurus |
| POST | /activities/reminders/run | Kirim notif H-1 (window 20–28 jam) | Ketua/Sekretaris/Wakil |
| POST | /attendances/check-in | Presensi QR/manual; GPS wajib jika geofence | Authenticated |
| GET | /attendances/me | Riwayat kehadiran sendiri | Authenticated |
| GET | /attendances/report?memberId= | Rekap rate per anggota (self atau Pengurus) | Authenticated |
| GET | /activities/:id/attendances | Rekap kehadiran per kegiatan | Pengurus |

## 3. Manajemen Project & Tugas (`/projects`, `/tasks`, `/submissions`, `/mentor-assignments`)
| Method | Path | Deskripsi | Role |
|---|---|---|---|
| GET | /projects | List project (+ task count) | Authenticated |
| GET | /projects/:id | Detail project + tasks | Authenticated |
| POST | /projects | Buat project baru | Pengurus, Kepala Divisi |
| GET | /projects/:id/tasks | List tugas (`?assigneeId=&status=`) | Authenticated |
| GET | /tasks/me | Tugas di-assign ke saya | Authenticated |
| POST | /tasks | Buat tugas (+ dueDate, notif assignee) | Pengurus, Kepala Divisi |
| GET | /tasks/:id/submissions | List submission per task | Authenticated |
| PATCH | /tasks/:id/status | Kanban; assignee ±1 kolom, pengurus free | Assignee, Pengurus |
| POST | /tasks/:id/assign | Assign + notifikasi | Pengurus, Kepala Divisi |
| POST | /tasks/:id/submissions | Submit (min 1 URL) → auto REVIEW | Assignee |
| GET | /submissions/:id | Detail submission + feedback | Authenticated |
| POST | /submissions/:id/feedback | Feedback | Pengurus **atau** mentor mentee |
| POST | /mentor-assignments | Pair mentor-mentee | Pengurus, Kepala Divisi |
| GET | /mentor-assignments/me | Pairing saya | Authenticated |
| POST | /tasks/reminders/deadlines | Notif tugas due &lt;24h | Ketua/Sekretaris/Wakil |

## 4. Event, Kompetisi & Prestasi (`/events`, `/gallery`)
| Method | Path | Deskripsi | Role |
|---|---|---|---|
| GET | /events | List (`?type=&upcoming=true\|false`) + counts | Authenticated |
| GET | /events/:id | Detail + prestasi + galeri preview | Authenticated |
| POST | /events | Buat event (location, capacity, registrationOpen) | Pengurus |
| POST | /events/reminders/run | H-1 notif (approved regs / all active) | Ketua/Sekretaris/Wakil |
| GET | /events/me/registrations | Pendaftaran saya | Authenticated |
| POST | /events/:id/register | Daftar (PENDING; cek kuota + open) | Authenticated |
| DELETE | /events/:id/register | Batalkan pendaftaran | Authenticated |
| GET | /events/:id/registrations | List pendaftar | Pengurus |
| PATCH | /events/:eventId/registrations/:regId | Approve/reject + notif | Pengurus |
| POST | /events/:id/achievements | Catat prestasi (+ notif anggota) | Pengurus |
| GET | /achievements | List prestasi (`?memberId=&eventId=`) | Authenticated |
| POST | /events/:id/gallery | Tambah foto (imageUrl) | Pengurus |
| GET | /gallery | Galeri (`?eventId=`) | Authenticated |

## 5. Keuangan Kas Ekskul (`/transactions`)
| Method | Path | Deskripsi | Role |
|---|---|---|---|
| GET | /transactions | List (`?periodId=&includeVoided=`) | Bendahara, Ketua |
| POST | /transactions | Catat (amount, category, description) | Bendahara, Ketua |
| POST | /transactions/:id/void | Soft-void transaksi | Bendahara, Ketua |
| GET | /transactions/report | Agregat + byCategory | Bendahara, Ketua |
| POST | /transactions/report/snapshot | Snapshot `FinancialReport` | Bendahara, Ketua |
| GET | /transactions/report/snapshots | Histori snapshot | Bendahara, Ketua |
| GET | /transactions/report.csv | Export CSV | Bendahara, Ketua |
| GET | /transactions/report.pdf | Export PDF | Bendahara, Ketua |

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
| GET | /badges | List badge | Authenticated |
| POST | /badges | Buat badge | Ketua |
| POST | /members/:id/badges | Award badge | Pengurus |
| GET | /leaderboard | Leaderboard poin | Authenticated |
| GET | /gamification/me | Poin, rank, badge, sertifikat saya | Authenticated |
| POST | /gamification/evaluate/me | Auto milestone badge | Authenticated |
| POST | /gamification/evaluate/:memberId | Auto milestone (pengurus) | Pengurus |
| POST | /certificates/generate | Buat record sertifikat | Pengurus |
| GET | /certificates/:id/pdf | Unduh PDF sertifikat | Authenticated |
| GET | /members/:id/certificates | List sertifikat anggota | Authenticated |

## 8. Auth & RBAC
Sudah tercakup di section **Auth** di atas, ditambah guard `RolesGuard` yang mengecek role dari `MemberPeriod.role` pada tiap request.

## Dashboard
| Method | Path | Deskripsi | Role |
|---|---|---|---|
| GET | /dashboard/overview | Stats real (members, projects, events, attendance 7h, loans, recruitment) | Authenticated |

## 9. Learning & Knowledge Base (`/learning-resources`, `/learning-paths`)
| Method | Path | Deskripsi | Role |
|---|---|---|---|
| GET | /learning-paths | List path (`?divisionId=`) + resource count | Authenticated |
| GET | /learning-paths/:id | Detail path + progress per resource | Authenticated |
| POST | /learning-paths | Buat path | Pengurus, Kepala Divisi |
| GET | /learning-resources | List materi (`?divisionId=&pathId=`) | Authenticated |
| POST | /learning-resources | Tambah materi (URL) | Pengurus, Kepala Divisi |
| GET | /learning-resources/:id/download | URL download | Authenticated |
| POST | /learning-resources/:id/complete | Tandai selesai | Authenticated |
| DELETE | /learning-resources/:id/complete | Unmark selesai | Authenticated |
| GET | /learning/progress/me | Riwayat progress saya | Authenticated |
| GET | /learning/progress/summary | % progress per path | Authenticated |

## 10. Rekrutmen Anggota Baru (`/recruitment`)
| Method | Path | Deskripsi | Role |
|---|---|---|---|
| POST | /recruitment/apply | Form (minat divisi, multi-stage FORM) | Public |
| GET | /recruitment | List (`?status=&stage=`) | Pengurus |
| GET | /recruitment/stats | Agregat stage/status | Pengurus |
| GET | /recruitment/:id | Detail + onboarding | Pengurus |
| PATCH | /recruitment/:id/stage | Set stage FORM→TEST→INTERVIEW→ANNOUNCEMENT | Pengurus |
| POST | /recruitment/:id/advance | Maju 1 tahap | Pengurus |
| PATCH | /recruitment/:id/onboarding | Update checklist onboarding | Pengurus |
| POST | /recruitment/:id/approve | Approve + buat akun + email | Pengurus |
| POST | /recruitment/:id/reject | Reject | Pengurus |

## 11. Pemilu & Voting Internal (`/elections`, `/polls`)
| Method | Path | Deskripsi | Role |
|---|---|---|---|
| GET | /elections | List pemilu + candidate counts | Authenticated |
| GET | /elections/:id | Detail (tanpa vote counts publik) | Authenticated |
| POST | /elections | Buat (description, endsAt) | Ketua |
| PATCH | /elections/:id/status | DRAFT/OPEN/CLOSED | Ketua |
| POST | /elections/:id/candidates | Tambah kandidat | Ketua |
| POST | /elections/:id/vote | Voting (1x; cek endsAt) | Authenticated |
| GET | /elections/:id/voted | Apakah saya sudah vote | Authenticated |
| GET | /elections/:id/results | Hasil (CLOSED; pengurus boleh open) | Authenticated |
| GET | /polls | List poll | Authenticated |
| POST | /polls | Buat poll | Pengurus |
| POST | /polls/:id/close | Tutup poll | Pengurus |
| GET | /polls/:id | Detail + opsi | Authenticated |
| POST | /polls/:id/vote | Vote poll | Authenticated |
| GET | /polls | List polling internal | Authenticated |
| POST | /polls | Buat polling baru | Pengurus |
| POST | /polls/:id/vote | Vote polling | Authenticated |

## 12. Peminjaman Inventaris (`/inventory`, `/inventory-loans`)
| Method | Path | Deskripsi | Role |
|---|---|---|---|
| GET | /inventory | List aset (qty + active loans) | Authenticated |
| POST | /inventory | Tambah aset (quantity, serial) | Pengurus |
| POST | /inventory/:id/loan-request | Ajukan (dueDate, notes) | Authenticated |
| GET | /inventory-loans | List loans (`?status=`) | Pengurus |
| GET | /inventory-loans/me | Pinjaman saya | Authenticated |
| GET | /inventory-loans/overdue | Overdue BORROWED | Pengurus |
| POST | /inventory-loans/overdue/notify | Notif overdue | Ketua/Sekretaris/Wakil |
| POST | /inventory-loans/:id/approve | Approve → BORROWED + notif | Pengurus |
| POST | /inventory-loans/:id/reject | Reject + notif | Pengurus |
| POST | /inventory-loans/:id/return | Kembalikan | Pengurus |

## 13. Portfolio Publik Otomatis (`/portfolio`)
| Method | Path | Deskripsi | Role |
|---|---|---|---|
| GET | /portfolio/:memberId | Halaman portfolio publik anggota | Public |
| GET | /portfolio/showcase | Showcase page ekskul (promosi) | Public |

## 14. Integrasi Eksternal (`/integrations`)
| Method | Path | Deskripsi | Role |
|---|---|---|---|
| GET | /integrations/status | Status GitHub/Discord/ICS config | Pengurus |
| POST | /integrations/github/webhook | Commit activity → submission count | Public + HMAC secret |
| POST | /integrations/discord/notify | Notifikasi Discord (stub jika no URL) | Pengurus |
| GET | /integrations/calendar/sync.ics | Export ICS (activity + event, H-1 alarm) | Authenticated |

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
