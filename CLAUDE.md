# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ContigoApp is a private health management platform for operating an insurance/EPS in Colombia. It gives patients a single place to book appointments, schedule lab exams, track their medical history, and manage medicine requests and deliveries. Doctors can manage their agendas and appointments, and staff can oversee the full operation.

## Commands

```bash
npm run dev      # Start dev server (http://localhost:5173)
npm run build    # Type-check and build for production (output: dist/)
npm run preview  # Preview the production build locally
```

## Tech Stack

- **Frontend:** React with Vite
- **Routing:** React Router (client-side)
- **Backend/DB:** Supabase (PostgreSQL + Auth)
- **Authentication:** GitHub OAuth via Supabase
- **Styling:** Tailwind CSS

## Key Rules

- Every database table must have Row Level Security (RLS) enabled.
- Every protected page must check for an active Supabase session before rendering.
- Never expose data from one user to another.
- Use environment variables for all secrets and keys.
- Write all database changes as SQL migration files in `supabase/migrations/` and apply them with `npx supabase db execute` — never ask the user to paste SQL into the Supabase dashboard manually.

## Database Migrations

All schema changes go in `supabase/migrations/` as SQL files. To apply pending migrations to the linked remote project:

```bash
npx supabase db push
```

Other useful Supabase CLI commands:

```bash
npx supabase db pull                         # Pull remote schema changes
npx supabase db push --dry-run               # Preview migrations without applying
npx supabase gen types typescript --local > src/types/supabase.ts
```

## Environment Variables

Stored in `.env` (git-ignored), using Vite's `VITE_` prefix:

- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` — Supabase publishable/anon key
