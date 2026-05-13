# Fitlog

A workout tracker built with Next.js 14 (App Router) + Supabase. Tracks lifts and cardio, surfaces progress and skipped movements, and shows visual progression with charts.

## Features

- Email/password auth via Supabase
- Movement library (weight or cardio with miles/km/meters)
- Today view: per-set entry, training-type dropdown for lifts, distance + time for cardio, collapse/expand cards, per-set delete
- Last-time-done indicator and weight progression cue (▲ +5 / ▼ -10 / =)
- History view of finished sessions with per-session volume
- Progress charts (top-set weight or distance) per movement
- Row-level security: every row is automatically scoped to the signed-in user

## Tech

- Next.js 14 (App Router, Server Components)
- TypeScript
- Tailwind CSS
- Supabase (`@supabase/ssr` + `@supabase/supabase-js`)
- Recharts

## Folder structure

```
fitlog-nextjs/
├── README.md
├── package.json
├── tsconfig.json
├── next.config.js
├── tailwind.config.ts
├── postcss.config.js
├── .env.local.example
├── .gitignore
├── middleware.ts
├── public/
└── src/
    ├── app/
    │   ├── layout.tsx
    │   ├── page.tsx                 # Today
    │   ├── globals.css
    │   ├── login/page.tsx
    │   ├── auth/callback/route.ts
    │   ├── movements/page.tsx
    │   ├── history/page.tsx
    │   └── progress/page.tsx
    ├── components/
    │   ├── Nav.tsx
    │   ├── SignOutButton.tsx
    │   ├── AuthForm.tsx
    │   ├── MovementCard.tsx
    │   ├── MovementsManager.tsx
    │   ├── AddMovementButton.tsx
    │   ├── FinishWorkoutButton.tsx
    │   ├── ProgressChart.tsx
    │   └── ProgressView.tsx
    └── lib/
        ├── types.ts
        ├── db.ts
        └── supabase/
            ├── client.ts
            └── server.ts
└── supabase/
    └── schema.sql
```

## 1. Set up Supabase

1. Create a project at https://app.supabase.com.
2. Open **SQL Editor** and paste in the contents of `supabase/schema.sql`. Run it.
3. In **Authentication → Providers**, make sure Email is enabled. (Disable email confirmation for the fastest local dev loop, or leave it on for production.)
4. In **Settings → API**, copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 2. Run locally

```bash
git clone <your repo url>
cd fitlog-nextjs
cp .env.local.example .env.local
# fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
npm install
npm run dev
```

Open http://localhost:3000 and create an account. Add a few movements, then start logging today's workout.

## 3. Deploy to Vercel

1. Push the project to a GitHub repo (the `.gitignore` already excludes `.env.local`, `node_modules`, and `.next`).
2. Go to https://vercel.com → **New Project** → import the GitHub repo.
3. Vercel auto-detects Next.js. In **Environment Variables**, add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   (Set both for *Production*, *Preview*, and *Development*.)
4. Click **Deploy**. Vercel runs `npm install` and `next build`.

Optional: in Supabase **Authentication → URL Configuration**, add your Vercel URL to *Site URL* and to *Redirect URLs* (e.g. `https://your-app.vercel.app/auth/callback`).

## Environment variables

| Name | Where it's used | Required |
| ---- | --------------- | -------- |
| `NEXT_PUBLIC_SUPABASE_URL` | client + server Supabase clients | yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client + server Supabase clients | yes |

The `anon` key is safe to expose to the browser — Row-Level Security in `supabase/schema.sql` ensures users can only read/write their own rows. **Never** put a `service_role` key in `NEXT_PUBLIC_*`.

## Pushing to GitHub

```bash
git init
git add .
git commit -m "Initial fitlog scaffold"
git branch -M main
git remote add origin git@github.com:<you>/fitlog.git
git push -u origin main
```

## Scripts

| Command | What it does |
| ------- | ------------ |
| `npm run dev` | Start the dev server on http://localhost:3000 |
| `npm run build` | Production build |
| `npm start` | Run the production build |
| `npm run lint` | ESLint |

## Notes

- Server Components fetch data with the cookie-bound Supabase client; client components use the browser client. Both share the same RLS policies.
- `middleware.ts` refreshes the session and redirects unauthenticated requests to `/login`.
- Set entries are stored as `jsonb` in `workout_entries.sets` so the same table handles weight (`{weight, reps, done}`) and cardio (`{distance, time, done}`) shapes.
