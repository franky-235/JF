# PM-Nerds

Internes Projektmanagement-Tool für 4–10 Benutzer.

## Features

- **Auth** – Invite-only via Supabase Auth (Email/Passwort)
- **Dashboard** – Überblick über Projekte, Kunden, Aufgaben
- **Projekte** – Vollständige Projektverwaltung mit Kundenzuordnung
- **Kanban-Board** – Drag & Drop mit Realtime-Updates
- **Timeline** – Gantt-Ansicht der Aufgaben (Wochen-/Monatsansicht)
- **Chat** – Pro-Projekt-Chat mit Supabase Realtime
- **Kundenverwaltung** – CRUD + HubSpot-Sync (read-only)
- **Settings** – Profilbearbeitung, Teamverwaltung, Benutzereinladung

## Setup

### 1. Dependencies installieren

```bash
npm install
```

### 2. Supabase Projekt erstellen

1. [supabase.com](https://supabase.com) → Neues Projekt
2. SQL Editor → Inhalt von `supabase/migrations/001_initial_schema.sql` ausführen
3. Project Settings → API → URL und Anon Key kopieren

### 3. Umgebungsvariablen konfigurieren

```bash
cp .env.local.example .env.local
```

Dann in `.env.local` ausfüllen:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
HUBSPOT_ACCESS_TOKEN=pat-na1-...   # Optional
```

### 4. Ersten Admin-Benutzer anlegen

In Supabase → Authentication → Users → "Invite user" oder direkt:

```sql
-- Nach dem ersten Login, in Supabase SQL Editor:
UPDATE profiles SET role = 'admin' WHERE id = 'deine-user-id';
```

### 5. Entwicklung starten

```bash
npm run dev
```

Öffne [http://localhost:3000](http://localhost:3000)

## Deployment (Vercel)

```bash
npx vercel --prod
```

Env-Variablen in Vercel-Projekteinstellungen hinzufügen.

## HubSpot-Integration

1. HubSpot → Settings → Integrations → Private Apps → App erstellen
2. Scope: `crm.objects.contacts.read`
3. Access Token in `.env.local` als `HUBSPOT_ACCESS_TOKEN` eintragen
4. In der App: Kunden → "HubSpot Sync" Button klicken

## Tech Stack

- **Next.js 14** (App Router)
- **Supabase** (PostgreSQL + Auth + Realtime)
- **Tailwind CSS**
- **@dnd-kit** (Drag & Drop)
- **date-fns** (Datumsfunktionen)
- **lucide-react** (Icons)
# pm-nerds
