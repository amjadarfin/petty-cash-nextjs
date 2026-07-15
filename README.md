# Petty Cash Management System — Next.js + PostgreSQL

A full-stack rebuild of the petty cash workflow (submission -> Deputy Director approval ->
Director final approval -> payment/settlement) using Next.js (App Router, Server Actions),
Prisma ORM, and PostgreSQL -- instead of SharePoint + Power Automate. Same roles, statuses,
and business rules as the requirements document; different plumbing underneath.

## What's implemented

- Role-based login (Staff, Deputy Director, Director, Accounts, System Owner)
- Draft -> Submit -> Deputy Director review -> Director final approval -> Payment -> Settlement
- Receipt/evidence upload with type and size validation
- **Concurrency-safe voucher numbering** -- uses a Postgres row lock (`SELECT ... FOR UPDATE`
  inside a transaction) so two simultaneous submissions can never collide, the direct
  equivalent of the ETag/If-Match retry loop in the SharePoint guide
- Budget head tracking with threshold warnings, fiscal-year allocation and available balance
- Director's final approval is **blocked at the database level** if the amount would exceed
  the available balance -- not just a warning
- Full audit trail (every submission, decision, and payment is logged with actor + timestamp)
- Petty cash register, reports, and an admin screen for budget heads
- Mandatory approval comments, return/reject/resubmit cycle tracking

## What's not built yet (honest scope note)

- User management UI (add new staff accounts via the seed script or Prisma Studio for now)
- Delegation/backup approver UI (the data model -- `ApproverConfig` -- supports it; there's no
  screen to edit it yet)
- Email/Teams notifications and the reminder/escalation flow (F-07 in the SharePoint guide)
- Fiscal year closure and carryforward automation (F-08) -- currently a manual DB update
- Evidence files are stored on local disk by default -- fine for a VPS or your own server,
  **but not fine for Vercel's serverless functions**, which have an ephemeral filesystem. If
  you deploy to Vercel, see "File storage on Vercel" below before going live.

Ask if you'd like any of these added -- the data model already anticipates most of them.

---

## 1. Get a free PostgreSQL database

**Neon** (recommended -- generous free tier, no credit card):
1. Go to https://neon.tech and sign up (GitHub or email)
2. Create a project -- pick a region close to you
3. Copy the connection string it gives you (starts with `postgresql://...`)

**Supabase** is a fine alternative (Settings -> Database -> Connection string), with the caveat
that free projects pause after 7 days of no activity (one click in the dashboard wakes it
back up).

## 2. Local setup

```bash
npm install
cp .env.example .env
```

Edit `.env`:
- `DATABASE_URL` -- paste your Neon/Supabase connection string
- `AUTH_SECRET` -- generate one with `openssl rand -base64 32` (or any random 32+ character string)
- `NEXTAUTH_URL` -- leave as `http://localhost:3000` for local dev

Create the database tables and seed sample data:
```bash
npx prisma migrate dev --name init
npm run db:seed
```

The seed script prints the login emails it created. All seeded accounts use the password
`Passw0rd!` -- **change these before real use** (via Prisma Studio: `npm run db:studio`, or
build a password-change screen).

Run it locally:
```bash
npm run dev
```
Open http://localhost:3000 and sign in.

## 3. Deploy for free (Vercel)

1. Push this project to a GitHub repository
2. Go to https://vercel.com, sign up free, click **Add New -> Project**, import your repo
3. Add the same three environment variables from your `.env` in Vercel's project settings
   (`DATABASE_URL`, `AUTH_SECRET`, and set `NEXTAUTH_URL` to your Vercel URL once you have it,
   e.g. `https://your-app.vercel.app`)
4. Deploy. Vercel's free "Hobby" tier is enough for an internal office tool at this scale.

### File storage on Vercel

Vercel's serverless functions don't keep files written to disk between requests -- anything
saved to `/storage/evidence` will vanish. Two options:

- **Easiest fix:** deploy instead to a small always-on host with persistent disk -- a cheap
  VPS, Render's free web service tier, or Railway's free trial -- where the current local-disk
  code works as-is.
- **Stay on Vercel:** swap the file-saving code in `lib/actions.ts` (`saveEvidence` function)
  for **Vercel Blob** (`npm install @vercel/blob`), which has a free allowance and a very
  similar API (`put(filename, buffer)` instead of `fs.writeFile`). Ask and I'll make this swap.

## 4. Everyday operations

- **Add a new staff member:** open `prisma/seed.ts`, add a new user block, run
  `npm run db:seed` again (it's idempotent -- re-running won't duplicate existing users) -- or
  use `npm run db:studio` to add a row directly in the `User` table (remember to hash the
  password with bcrypt; the seed script shows how).
- **Open a new fiscal year:** add a row via Prisma Studio (`FiscalYear` table), set the
  previous year's `status` to `CLOSED`.
- **Change budget limits or thresholds:** Admin screen in the app (System Owner login), or
  directly in Prisma Studio.
- **Inspect the database directly any time:** `npm run db:studio` opens a local browser UI
  over your real data.

## 5. Project structure

```
app/                  Pages (App Router) -- one folder per route
  requests/new         Submission form
  requests/mine         Staff's own requests
  requests/[id]          Detail view + review actions (context-aware by role)
  approvals/dd, approvals/director   Approval queues
  payments, payments/open            Accounts screens
  register, reports, admin, audit    Shared/reporting screens
  api/evidence/[...path]             Authenticated file download route
lib/
  auth.ts              NextAuth (Auth.js v5) credentials login
  prisma.ts            Prisma client singleton
  pettycash.ts          Voucher numbering, budget math, audit logging
  actions.ts            All Server Actions (the actual business logic)
prisma/
  schema.prisma        Full data model
  seed.ts               Sample users, fiscal year, budget heads
```

## 6. A note on Prisma versions

This project is pinned to **Prisma 6.x**, not the newly released Prisma 7. Prisma 7 changes
the configuration format entirely (a new `prisma.config.ts` file, mandatory driver adapters,
ESM-only) and has open issues with Next.js 16's Turbopack bundler as of this writing. Prisma
6 is stable, thoroughly documented, and everything in this project works with it today. If
you want to upgrade later, Prisma's official migration guide is at
https://www.prisma.io/docs/orm/more/upgrade-guides/upgrading-versions/upgrading-to-prisma-7
