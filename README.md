# Section X Scoreboard

Modern home for Section X high school sports scores, standings, schedules, and more.

**Live site:** sectionxscoreboard.com  
**Stack:** Next.js 14 App Router · TypeScript · Tailwind CSS · Supabase

---

## Quick Start

### 1. Clone & install

```bash
git clone https://github.com/YOUR_USERNAME/section-x-scoreboard.git
cd section-x-scoreboard
npm install
```

### 2. Set up environment variables

```bash
cp .env.local.example .env.local
```

Fill in your Supabase credentials from your Supabase project dashboard under **Settings → API**:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3. Set up the database

In your Supabase dashboard, open the **SQL Editor** and run these files in order:

1. `supabase/migrations/001_initial.sql` — creates all tables, indexes, RLS policies
2. `supabase/seed.sql` — loads all 24 schools, sports, teams, and seasons

### 4. Set up Supabase Storage (for photos)

1. Go to **Storage** in your Supabase dashboard
2. Create a new bucket called `photos`
3. Set it to **Public**
4. Add a policy: allow INSERT for anon users (public photo submissions)

### 5. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Project Structure

```
src/
├── app/
│   ├── (public)/          # All public-facing pages
│   │   ├── page.tsx       # Homepage
│   │   ├── scores/        # /scores and /scores/[date]
│   │   ├── sports/[slug]/ # Sport pages
│   │   ├── schools/       # All schools + individual school pages
│   │   ├── teams/[slug]/  # Team pages
│   │   ├── games/[id]/    # Game detail + correction form
│   │   ├── standings/     # Standings with sport filter
│   │   ├── photos/        # Photo gallery
│   │   ├── shoutout/      # Shoutout submission
│   │   ├── submit-score/  # Public score submission
│   │   ├── submit-photo/  # Public photo submission
│   │   └── advertise/     # Sponsor/advertise page
│   ├── admin/             # Admin pages (all client-side)
│   │   ├── page.tsx       # Dashboard
│   │   ├── scores/entry/  # Single score entry
│   │   ├── import/        # Bulk import center (paste/CSV/Arbiter)
│   │   ├── submissions/   # Public submission approval queue
│   │   ├── photos/        # Photo approval queue
│   │   ├── shoutouts/     # Shoutout approval queue
│   │   ├── corrections/   # Correction request queue
│   │   ├── seasons/       # Season manager + new season wizard
│   │   ├── schools/       # School CRUD
│   │   ├── teams/         # Team activation by season
│   │   ├── sponsors/      # Sponsor manager
│   │   └── settings/      # Site settings
│   └── layout.tsx         # Root layout
├── components/
│   ├── layout/            # PublicLayout, AdminLayout
│   ├── home/              # HomeClient
│   └── scores/            # ScoreCard
├── lib/
│   ├── supabase/          # Browser + server clients
│   ├── constants.ts       # Sports, schools, aliases, helpers
│   ├── parser.ts          # Schedule/score paste parser
│   └── standings.ts       # Standings calculator
└── types/
    └── index.ts           # All TypeScript types
```

---

## Deploying to Vercel

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com) and import the repo
3. Add all three environment variables in Vercel's project settings
4. Deploy — Vercel auto-detects Next.js

For the domain:
- Add `sectionxscoreboard.com` as a custom domain in Vercel
- Point your DNS to Vercel's nameservers or add the CNAME/A records

---

## Admin Access

Admin pages live at `/admin/*`. There's no auth built in by default — recommended options:

**Option A: Vercel Password Protection** (simplest)  
Add `VERCEL_BASIC_AUTH_PASSWORD` and use Vercel's built-in basic auth.

**Option B: Supabase Auth** (proper)  
Add Supabase Auth email/password flow. Wrap all `/admin` routes with a session check in `middleware.ts`.

**Option C: Simple secret path**  
Use an obscure URL that only you know. Fine for early launch.

---

## Import Center

Admin → Import Center supports three methods:

### Paste Import (bulk scores)
```
Canton 8, Potsdam 3 Final
Massena 12, OFA 7 Final
Madrid-Waddington 11, St. Lawrence Central 1 Final
```

### Schedule Paste (full schedule)
```
Lisbon at Madrid-Waddington, canceled
Canton 19, Massena 4
Heuvelton 5, Brushton-Moira 3 (2nd game)
Madrid-Wadd. at Parishville-Hopkinton (1st) 3:30
```

### CSV Import
Headers: `date,home_team,away_team,home_score,away_score,status,time,location`

The parser detects team aliases automatically (OFA, MW, SLC, NN, HD, BM, PH, SR, SRF, TL, GOUV).

---

## Season Management

1. Go to **Admin → Season Manager**
2. Click **Start New Season**
3. Pick season type + year
4. Optionally copy team activations from a prior season
5. Click **Set Active** on the new season to make it the homepage default

Old seasons stay fully intact with all historical scores.

---

## SEO URLs

```
/                                            Homepage
/scores                                      Today's scores
/scores/2026-04-29                           Scores by date
/sports/baseball                             Baseball scores + standings
/sports/softball
/sports/boys-lacrosse
/schools/ogdensburg-free-academy             School page
/schools/canton                              School page
/teams/canton-baseball                       Team page
/teams/ofa-boys-lacrosse
/standings                                   All standings
/standings?sport=baseball
/games/[uuid]                                Game detail
/photos                                      Photo gallery
/shoutout                                    Submit a shoutout
/submit-score                                Public score submission
/submit-photo                                Photo submission
/advertise                                   Sponsor page
```

---

## School Aliases (for import parser)

| Alias | School |
|-------|--------|
| OFA | Ogdensburg Free Academy |
| MW | Madrid-Waddington Central |
| SLC | St Lawrence Central School |
| NN | Norwood-Norfolk Central |
| HD | Hermon-Dekalb Central School |
| BM | Brushton-Moira Central School |
| PH | Parishville-Hopkinton Central School |
| SR | Salmon River Central School |
| SRF | St Regis Falls Central School |
| TL | Tupper Lake Central School |
| GOUV | Gouverneur Central School |
| HCS | Heuvelton Central School |
| CF | Clifton-Fine Central School |
| CP | Colton-Pierrepont Central School |
| EK | Edwards-Knox Central School |
| LCS | Lisbon Central School |

---

## Tech Stack Details

- **Next.js 14** App Router with server components for SEO and speed
- **Supabase** for Postgres database, auth (optional), and photo storage
- **Tailwind CSS** with custom dark navy scoreboard theme
- **Fuse.js** for fuzzy team name matching in the import parser
- **date-fns** for date formatting
- **lucide-react** for icons

---

*Built for Section X — North Country high school sports.*
