# ITCLUB Ekskul Management System

Internal platform for IT Club operations: membership, attendance, projects, events, finance, recruitment, and more.

| Package | Stack | Path |
|---|---|---|
| **api** | NestJS + Prisma + PostgreSQL | [`api/`](./api) |
| **web** | Astro + React islands + Tailwind | [`web/`](./web) |

Mobile (Flutter) — planned, not in repo yet.

## Prerequisites

- Node.js ≥ 22.12
- PostgreSQL 16 (or Docker/Podman)
- npm 10+

## Quick start (local)

```bash
# 1. Env
cp .env.example .env
# Generate secrets:
#   openssl rand -hex 32   → JWT_SECRET
#   openssl rand -hex 32   → JWT_REFRESH_SECRET

cp api/.env.example api/.env
# Paste same JWT_* + DATABASE_URL into api/.env

# 2. Database
docker compose up -d db
# or podman compose up -d db

# 3. API
cd api
npm ci
npx prisma migrate dev
npx ts-node prisma/seed.ts
npm run start:dev

# 4. Web (another terminal)
cd web
npm ci
echo 'PUBLIC_API_URL=http://localhost:3000/api/v1' > .env
npm run dev
```

## Docker (full stack)

```bash
cp .env.example .env
# MUST set JWT_SECRET + JWT_REFRESH_SECRET (min 32 chars, not placeholders)
docker compose up --build
```

- Web: http://localhost:8080  
- API: http://localhost:3000/api/v1  

## Seed accounts

Password for all: `password123`

| Role | Email |
|---|---|
| KETUA | ketua@clubit.local |
| WAKIL_KETUA | wakil@clubit.local |
| SEKRETARIS | sekretaris@clubit.local |
| BENDAHARA | bendahara@clubit.local |
| KEPALA_DIVISI | kadiv@clubit.local |
| ANGGOTA | anggota@clubit.local |

## Prisma schema

**Single source of truth:** `api/prisma/schema.prisma`  
Do not edit a root-level schema. Root `schema.prisma` is a symlink (or mirror) for tooling only.

```bash
cd api && npx prisma migrate dev
```

## Docs

- Product / agent context: [`AGENTS.md`](./AGENTS.md)
- API endpoint map: [`API-SPEC.md`](./API-SPEC.md)
- API details: [`api/README.md`](./api/README.md)

## Monorepo scripts (root)

```bash
npm run dev:api
npm run dev:web
npm run test
npm run ci
```

## Security notes

- Login blocked until member `approvalStatus = APPROVED` and status not `INACTIVE`
- JWT access claims re-resolved from DB every request (role never stale)
- Production refuses placeholder JWT secrets
- GitHub webhook signature required in production
- Audit log on auth, membership, finance, recruitment, voting
- **HttpOnly cookies** (`clubit_access`, `clubit_refresh`) — tokens not readable by JS
- Same-origin API: Vite/nginx proxy `/api` → Nest so cookies work without cross-site
- Web uses `credentials: "include"`; auto-refresh on 401 via cookie
- Daily cron 08:00: activity/event H-1, task deadlines, inventory overdue (`REMINDERS_CRON=false` to disable)
