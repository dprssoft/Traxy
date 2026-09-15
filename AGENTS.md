# AGENTS.md

Guidance for AI coding agents working in this repository.

## Project Overview

Traxy is a local-first, self-hostable multimedia tracking app. Users track films, TV, games,
anime, manga, books, and comics in a database that lives entirely on their own device — there is
no backend server, no user accounts, and no multi-user data.

- **Frontend**: SvelteKit 2 + Svelte 5 (Runes) + TypeScript + Tailwind CSS 4
- **Storage**: on-device SQLite — `@capacitor-community/sqlite` on Android, `sql.js`/`jeep-sqlite`
  (WASM) on web
- **Mobile**: Capacitor 8 (Android project at `frontend/android/`)
- **Infrastructure (optional web hosting only)**: Docker Compose + Caddy reverse proxy in front of
  the SvelteKit Node server — not needed for local dev or the Android build

## Repo Layout

```
frontend/            SvelteKit application (see below)
frontend/android/    Native Android project (Capacitor)
frontend/features/   Cucumber.js BDD feature files (UI-scoped, Ukrainian Gherkin)
docs/ui-research/    Competitor UI reference screenshots — not app documentation
scripts/             Android build/adb helper shell scripts
Caddyfile             Optional reverse proxy config, used only by the Docker web deployment
docker-compose.yaml   Optional Docker Compose stack (caddy + web), for self-hosted web deployment
```

There is no backend service, no `seeder/`, and no root-level `features/` directory — everything
app-related lives under `frontend/`.

## Commands — work from `frontend/`

| Command | Purpose |
|---|---|
| `pnpm dev` | Start the Vite dev server |
| `pnpm build` | Production build |
| `pnpm check` | `svelte-kit sync && svelte-check` — should pass before committing |
| `pnpm lint` | ESLint |
| `pnpm test:unit` | Vitest unit tests (`src/**/*.test.ts`) |
| `pnpm test:bdd` | Cucumber.js against `frontend/features/*.feature` |

The frontend uses **pnpm 11** (`packageManager` field, `engine-strict=true` in `.npmrc`) — not npm.

## Architecture

### Data flow

There is no API layer. A page or component calls a service in `src/lib/db/services/`, which reads
and writes the on-device SQLite database (via `src/lib/db/index.ts` / `getDb()`) and, for
metadata, calls a provider adapter in `src/lib/db/sources/` directly from the client — TMDB, IGDB,
ComicVine, AniList, Open Library, HowLongToBeat, Flashpoint, Wikipedia. Provider responses are
cached locally in the `ApiCache` table (`src/lib/db/apiCache.ts`) to cut down on repeat network
calls.

In dev, several provider APIs block browser CORS — `vite.config.ts` proxies them under
`/api-proxy/<provider>` (see `server.proxy` / `preview.proxy`). Capacitor's native HTTP client
bypasses CORS entirely on Android, so that proxy is web-dev-only and isn't present in the
production build.

### Local database schema (`src/lib/db/index.ts` / `schema.ts`)

| Table | Notes |
|---|---|
| `Media` | Cached metadata from a provider (or `source: 'manual'`); deduped on `(source, externalId)` |
| `TrackingStatus` | One row per tracked `Media`; status/progress/score/note |
| `WatchCycle` | Rewatch/replay history per `Media` |
| `Collection` / `CollectionItem` | User-defined lists |
| `ActivityLog` | Event feed — status changes, progress updates, imports, errors |
| `Goal` | Yearly per-media-type completion targets |
| `ApiCache` | TTL-based cache of provider responses |
| `AppSettings` | Key/value app settings |

There is no soft-delete pattern and no auth/role columns anywhere in this schema — it's a
single-user, on-device database, not a multi-tenant one.

### Frontend structure

```
src/
  routes/         File-based SvelteKit pages (catalogue, tracking, collections, stats, settings…)
  lib/
    components/   Reusable Svelte UI components (components/ui/ = shared atoms, barrel-exported)
    db/
      services/   All reads/writes go through here — see "Service layer is mandatory" below
      sources/    One file per external metadata provider
    stores/       Svelte 5 rune-based client state (API keys, search prefs, layout, goals…)
    types/        Shared TypeScript interfaces
    utils/        Pure helper functions
```

There is no `hooks.server.ts` and no server-side auth — SvelteKit is used purely as a file-based
router for a client-side app here, not as a backend framework.

## BDD testing

`frontend/features/*.feature` (Ukrainian Gherkin, `language: uk` header) is the only feature-file
directory in this repo, consumed by Cucumber.js via `frontend/cucumber.cjs`. Keep new scenarios in
Ukrainian to match. There is no second, backend-oriented feature set — don't invent one.

## Configuration

- **User API keys** (TMDB, IGDB Client ID/Secret, ComicVine) are entered in-app under
  **Settings → API Keys** and stored in `localStorage`
  (`src/lib/stores/apiKeys.svelte.ts`) — most users never touch an `.env` file. Anime/Manga
  (AniList) and Books (Open Library) work with no key at all.
- **`frontend/.env`** (gitignored, see `frontend/.env.example`) is an optional developer
  convenience that pre-fills those same keys via `VITE_TMDB_API_KEY`, `VITE_IGDB_CLIENT_ID`,
  `VITE_IGDB_CLIENT_SECRET`, `VITE_COMICVINE_API_KEY`.
- **Root `.env.example`** exists for the optional Docker web deployment, but nothing in
  `docker-compose.yaml` currently reads a root `.env` (the `web` service's `env_file` points at
  `frontend/.env`, not a root one). Treat it as a documented-but-unwired placeholder, not as
  something that already works end-to-end — verify before relying on it.

## Critical details

- **No backend, no server-side secrets to protect**: every provider call is made directly from the
  client using the user's own key. Don't design a feature around a trusted server that doesn't
  exist here.
- **Vite dev proxy** (`vite.config.ts`): `/api-proxy/<twitch|igdb|comicvine|hltb>` exists only to
  work around browser CORS in web dev — it's not used on Android and isn't present in the
  production build.
- **`pnpm check`** runs `svelte-kit sync && svelte-check` — should pass before tests.
- **No CI** is configured in this repository.

## Conventions

- **Formatting**: Prettier enforces tabs and a 100-char line width with the Svelte plugin. Run
  `pnpm lint` before committing.

## Component & Architecture Rules

### Reuse before building
Before creating any UI element, check `src/lib/components/` and `src/lib/components/ui/`.
If a suitable component exists, reuse or extend it. Do NOT duplicate or build ad-hoc DIY solutions.
- Never write inline custom button/badge/card styling (e.g., ad-hoc `bg-[#121422]` divs or custom button markups) when shared atoms exist. Use `Card`, `Button`, `Badge`, etc.
- Use `CataloguePosterCard.svelte` for any list or grid displaying media items. Do NOT recreate poster + title + metadata cards from scratch.
- **No-DIY rule applies project-wide**: before writing any utility, hook, helper, or logic, search the codebase first. If equivalent code exists anywhere in `src/lib/`, reuse or extend it — never duplicate.

### Service layer is mandatory
Pages and components MUST NOT import directly from `$lib/db/index` or run SQL queries directly.
All data access and mutations MUST go through a service in `$lib/db/services/`.

### Thin stores
Stores (`src/lib/stores/`) are strictly for reactive client state. Do not put business logic or direct persistence queries into stores; delegate to services.

### Settings architecture
Never dump all settings UI into a single monolithic page.
Each settings section lives in its own sub-route under `routes/settings/<section>/+page.svelte`.

### Feature flags for extensions
New optional or upcoming features must be gated by a flag key in `AppSettings` (e.g. `feat_cloud_sync`, `feat_catalogue`, `feat_rewind`). Always check the flag before rendering associated UI or route segments.

## Git & Commit Discipline

Every change must be committed as a real programmer would:
- One logical change per commit; do not bundle unrelated edits.
- Commit message format: `<type>(<scope>): <short imperative summary>` (Conventional Commits).
  - Types: `feat`, `fix`, `refactor`, `chore`, `test`, `docs`, `style`.
  - Scope: the affected subsystem or route (e.g. `tracking`, `catalogue`, `media`, `stats`).
- Stage only the files relevant to the commit; do not stage unintended changes.
- Never commit `.env` files, generated build artifacts, or editor metadata.
- Run `pnpm lint` before committing.

## Agent Chat Style

- **Caveman mode**: responses in chat must be strictly brief — answer only what was asked, skip
  filler, preamble, and post-summaries. Every token counts.
- **No auto-proceed on plans**: always stop after presenting a plan and wait for explicit user
  approval before executing any changes.
