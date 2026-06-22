# Startup Digest

A **personal founder inspiration tool**. It pulls the latest Product Hunt launches every week, runs each one through an AI "solo SaaS founder" analysis, and emails you a weekly digest of products **worth building a sharper, more focused, or more niche version of**.

It runs the full founder loop — **discover → evaluate → decide → act**:

- **Discover** the week's *top-voted* launches, ranked by a 0–100 **Opportunity Score** (demand × monetization × clone potential × ease).
- **Evaluate** each with an AI "solo founder" analysis: why it's interesting, weaknesses, clone score, build difficulty, demand & monetization signals, niche/AI/localized angles, and a blunt founder take.
- **Decide** by triaging every idea — **New / Saved / Building / Passed** — with filtering and sorting.
- **Act** with a generated **MVP Build Plan** for *your* sharper version: target niche, differentiation, core features, tech stack, week-by-week milestones (checkable, with progress), first steps, risks, and monetization — plus your own notes.
- Personalize everything via a **Founder Profile** (skills, stack, interests, time budget) injected into every analysis and plan.
- Get it all weekly by **email** (Resend) on a **Vercel Cron**.

> Single-user tool, behind a simple password gate. No teams, no multi-user, no payments — by design.

---

## Tech Stack

| Layer      | Choice                                             |
| ---------- | -------------------------------------------------- |
| Framework  | Next.js 15 (App Router) + TypeScript               |
| UI         | Tailwind CSS + shadcn/ui                           |
| Backend    | Next.js API routes + Server Actions                |
| ORM        | Prisma                                             |
| Database   | Local PostgreSQL (dev) / Supabase Postgres (prod)  |
| AI         | OpenRouter (`openai/gpt-4o-mini` by default)       |
| Data       | Product Hunt GraphQL API                           |
| Email      | Resend                                             |
| Hosting    | Vercel                                             |
| Automation | Vercel Cron (every Monday 08:00 UTC)               |

---

## Project Structure

```
app/
  page.tsx                         # Home — top products worth building
  dashboard/page.tsx               # Stats, actions, searchable product table
  products/[id]/page.tsx           # Product detail + full analysis
  digests/page.tsx                 # Digest history
  actions.ts                       # Server Actions (sync / analyze / digest)
  api/
    cron/weekly-digest/route.ts    # Full weekly pipeline (Vercel Cron)
    products/sync/route.ts         # POST: fetch + save launches
    products/analyze-all/route.ts  # POST: analyze all un-analyzed products
    products/[id]/analyze/route.ts # POST: analyze one product
    digest/test/route.ts           # POST: generate digest + send test email
components/                        # sidebar, header, cards, table, ui/*
lib/
  prisma.ts  producthunt.ts  ai.ts  digest.ts  email.ts  types.ts  auth.ts  utils.ts
prisma/
  schema.prisma
vercel.json                        # Cron schedule
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in:

```bash
cp .env.example .env
```

| Variable                    | Description                                                          |
| --------------------------- | -------------------------------------------------------------------- |
| `DATABASE_URL`              | Postgres connection string. In prod: Supabase **pooled** (`:6543`, append `?pgbouncer=true&connection_limit=1`) |
| `DIRECT_URL`                | Direct (non-pooled `:5432`) Postgres string — used only by `prisma migrate`. Locally, same as `DATABASE_URL` |
| `PRODUCT_HUNT_ACCESS_TOKEN` | Product Hunt developer token                                         |
| `OPENROUTER_API_KEY`        | OpenRouter API key                                                   |
| `OPENROUTER_MODEL`          | Model id — defaults to `openai/gpt-4o-mini`                          |
| `RESEND_API_KEY`            | Resend API key                                                       |
| `DIGEST_EMAIL_TO`           | Where the weekly digest is delivered                                 |
| `DIGEST_EMAIL_FROM`         | (optional) Verified sender; defaults to `onboarding@resend.dev`      |
| `CRON_SECRET`               | Shared secret protecting cron + manual API routes                    |
| `APP_PASSWORD`              | Password for the `/login` gate. **Required in prod**; leave empty locally to keep the app open |
| `AUTH_SECRET`               | Random secret used to sign the session cookie. **Required in prod**  |
| `NEXT_PUBLIC_APP_URL`       | Public base URL (used for links in emails). No trailing slash.       |

> **Auth:** when `APP_PASSWORD` + `AUTH_SECRET` are set, the whole app (pages **and** Server Actions) sits behind a single-user password gate at `/login`; `/api/*` routes stay protected by `CRON_SECRET`. With both unset (local dev), the gate is disabled for convenience.

---

## Local Development Setup

### 1. Create a local PostgreSQL database

With a local Postgres server running:

```bash
createdb startup_digest
# or: psql -U postgres -c "CREATE DATABASE startup_digest;"
```

### 2. Set `DATABASE_URL`

In `.env`:

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/startup_digest"
```

### 3. Install dependencies and run the Prisma migration

```bash
npm install
npx prisma migrate dev --name init
```

This creates the `Product`, `ProductAnalysis`, and `WeeklyDigest` tables and generates the Prisma client.

### 4. Get a Product Hunt API token

1. Go to https://www.producthunt.com/v2/oauth/applications
2. Create an application.
3. Generate a **Developer Token**.
4. Set `PRODUCT_HUNT_ACCESS_TOKEN` in `.env`.

### 5. Get an OpenRouter API key

1. Sign up at https://openrouter.ai
2. Create a key at https://openrouter.ai/keys
3. Set `OPENROUTER_API_KEY` in `.env` (and optionally `OPENROUTER_MODEL`).

### 6. Set the Resend API key

1. Create a key at https://resend.com/api-keys
2. Set `RESEND_API_KEY` and `DIGEST_EMAIL_TO` in `.env`.
3. For real sending from your own domain, verify it in Resend and set `DIGEST_EMAIL_FROM`. The default `onboarding@resend.dev` works for testing to your own address.

### 7. Run the dev server

```bash
npm run dev
```

Open http://localhost:3000.

> In development, if `CRON_SECRET` is empty the API routes are open so you can test quickly. The dashboard buttons use Server Actions and never expose secrets to the browser.

### Try the full flow

1. Open **/dashboard**.
2. Click **Sync Product Hunt** → launches are stored.
3. Click **Analyze All** → OpenRouter analyses are generated.
4. Open a product to view its **detail + analysis**.
5. Click **Send Test Digest** → a digest is generated and emailed.

---

## Production Deployment (Vercel + Supabase)

### 1. Create a Supabase project

https://supabase.com/dashboard → **New project**.

### 2. Copy the pooled connection string

Supabase → **Project Settings → Database → Connection pooling** (Transaction mode, port `6543`). It looks like:

```
postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true
```

### 3–9. Add environment variables in Vercel

In your Vercel project → **Settings → Environment Variables**, add:

- `DATABASE_URL` (the Supabase pooled string)
- `PRODUCT_HUNT_ACCESS_TOKEN`
- `OPENROUTER_API_KEY` (and optional `OPENROUTER_MODEL`)
- `RESEND_API_KEY`
- `DIGEST_EMAIL_TO` (and optional `DIGEST_EMAIL_FROM`)
- `CRON_SECRET` (a long random string — **required in production**)
- `NEXT_PUBLIC_APP_URL` (e.g. `https://your-app.vercel.app`)

### 10. Deploy to Vercel

Push to your connected Git repo, or:

```bash
vercel --prod
```

The build runs `prisma generate && next build` automatically.

### 11. Run Prisma migrations against production

Point `DATABASE_URL` at Supabase locally (or use Vercel's env) and run:

```bash
npx prisma migrate deploy
```

Prisma uses `DIRECT_URL` (the non-pooled `:5432` string) for migrations automatically, while the app runs on the pooled `DATABASE_URL`. Make sure both are set in your environment before running `migrate deploy`.

> **Vercel plan & the cron budget:** the weekly cron analyzes products with bounded concurrency and a per-run cap (`ANALYZE_CAP`, default 10) plus an 18s per-call timeout, so a single invocation finishes within **~45s** — inside even the Hobby plan's 60s function limit. The backlog (if any) drains across runs and the manual **Analyze All** button. On **Pro**, `maxDuration` (300s) lets you safely raise the caps if you ingest more launches.

### Weekly automation

`vercel.json` registers a cron job:

```json
{ "crons": [{ "path": "/api/cron/weekly-digest", "schedule": "0 8 * * 1" }] }
```

Every Monday 08:00 UTC, Vercel calls `/api/cron/weekly-digest` (with your `CRON_SECRET`), which:

1. Fetches the latest Product Hunt launches.
2. Saves new products (deduped by Product Hunt ID).
3. Analyzes any product without an analysis.
4. Generates the weekly digest.
5. Saves it to the database.
6. Emails it via Resend.
7. Returns a JSON result.

---

## Manual API Routes

All require the `CRON_SECRET` via `Authorization: Bearer <secret>` or `?secret=<secret>`.

```bash
# Sync latest launches
curl -X POST "$APP/api/products/sync" -H "Authorization: Bearer $CRON_SECRET"

# Analyze everything un-analyzed
curl -X POST "$APP/api/products/analyze-all" -H "Authorization: Bearer $CRON_SECRET"

# Analyze a single product
curl -X POST "$APP/api/products/<id>/analyze" -H "Authorization: Bearer $CRON_SECRET"

# Generate an MVP build plan for a product
curl -X POST "$APP/api/products/<id>/build-plan" -H "Authorization: Bearer $CRON_SECRET"

# Generate + send a test digest
curl -X POST "$APP/api/digest/test" -H "Authorization: Bearer $CRON_SECRET"

# Run the full weekly pipeline manually
curl "$APP/api/cron/weekly-digest?secret=$CRON_SECRET"
```

---

## Scripts

| Command              | Description                              |
| -------------------- | ---------------------------------------- |
| `npm run dev`        | Start the dev server                     |
| `npm run build`      | `prisma generate` + production build     |
| `npm run start`      | Start the production server              |
| `npm run db:migrate` | `prisma migrate dev`                     |
| `npm run db:deploy`  | `prisma migrate deploy` (production)     |
| `npm run db:studio`  | Open Prisma Studio                       |
