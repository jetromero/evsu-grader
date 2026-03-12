# EVSU Ormoc Campus — Latin Honors Interview Grading System

A web-based grading system for the Latin Honors interview process at Eastern Visayas State University, Ormoc Campus.

## Tech Stack

- **Next.js 14** (App Router) + TypeScript
- **Tailwind CSS** with EVSU Maroon & Gold branding
- **Supabase** (PostgreSQL, Auth, Realtime)
- **jsPDF** + **SheetJS** for PDF/Excel exports
- **Lucide React** icons

## Getting Started

### 1. Clone and install

```bash
cd evsu-grader
npm install
```

### 2. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the migration in `supabase/migration.sql`
3. Copy your project URL and keys from **Settings > API**

### 3. Configure environment

Copy the example and fill in your values:

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 4. Create admin user

1. In Supabase Dashboard → Authentication → Users: create a user (e.g. `admin@evsu.edu.ph`)
2. Copy the user's UUID
3. In SQL Editor, run:

```sql
INSERT INTO profiles (id, full_name, role, email)
VALUES ('YOUR-USER-UUID', 'Admin Name', 'admin', 'admin@evsu.edu.ph');
```

### 5. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 6. Deploy to Vercel

```bash
npx vercel
```

Set the same environment variables in Vercel project settings.

## Project Structure

```
app/
  login/              → Login page
  panelist/
    dashboard/        → Panelist home
    session/[id]/     → Student list for session
    grade/[studentId] → Grading form
  admin/
    dashboard/        → Admin home
    students/         → Student management + CSV upload
    sessions/         → Session management
    sessions/[id]/results/ → Results + export
    panelists/        → Panelist accounts
components/
  ui/                 → Button, Card, Badge, Modal, Input, Select
  rubric/             → RubricCard, ScorePreview
lib/
  supabase.ts         → Browser Supabase client
  supabase-server.ts  → Server Supabase client
  auth-context.tsx    → Auth provider & hook
  scoring.ts          → Weighted score calculation + rubric data
  csvParser.ts        → CSV upload parsing
types/
  index.ts            → TypeScript interfaces
supabase/
  migration.sql       → Full database schema + RLS policies
```

## Features

- Role-based auth (Admin + Panelist)
- CSV bulk upload of students with date parsing
- Per-criterion 1–5 scoring with live descriptor display
- Color-coded score buttons (red → green scale)
- Real-time weighted score preview during grading
- Academic dishonesty flag with automatic disqualification
- Confirmation modal before final submission
- Multi-panelist support with independent scoring
- Admin finalizes session to publish results
- Live progress tracking (Supabase Realtime)
- PDF and Excel export per session
- Fully responsive (mobile, tablet, desktop)

## Scoring Formula

```
Weighted Score = (
  Academic       × 0.25 +
  Critical       × 0.20 +
  Communication  × 0.20 +
  Values         × 0.15 +
  Leadership     × 0.10 +
  Professionalism × 0.10
) × 20
```

- Score ≥ 85 → **Qualified**
- Score < 85 → **Not Qualified**
- Any dishonesty flag → **Disqualified**
