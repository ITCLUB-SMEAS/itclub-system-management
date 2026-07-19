# ITCLUB API

NestJS + Prisma + PostgreSQL backend for ITCLUB Ekskul Management.

Base URL: `http://localhost:3000/api/v1`

## Setup

```bash
# DB (port 5433 — host 5432 already used)
podman run -d --name clubit-pg \
  -e POSTGRES_USER=clubit -e POSTGRES_PASSWORD=clubit -e POSTGRES_DB=clubit \
  -p 5433:5432 docker.io/library/postgres:16-alpine
# or: podman compose / docker compose up -d

cp .env.example .env
npm install
npx prisma migrate dev
npx ts-node prisma/seed.ts
npm run start:dev
```

## Seed login

- Email: `ketua@clubit.local`
- Password: `password123`
- Role: `KETUA`

## Response envelope

```json
{ "data": {}, "message": "OK", "error": null }
```

## Auth

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"identifier":"ketua@clubit.local","password":"password123"}'
```

Use `Authorization: Bearer <accessToken>` on protected routes.

See root `API-SPEC.md` for full endpoint list.
