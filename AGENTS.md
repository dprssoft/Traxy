# AGENTS.md

Guidance for AI coding agents working in this repository.

## Project Overview

TrackList is a full-stack, self-hostable media tracking and review web application. Users log
films, TV shows and books; write reviews; follow others; and browse a personalized feed.

- **Frontend**: SvelteKit 2 + Svelte 5 + TypeScript + Tailwind CSS 4, served via the Node adapter
- **Backend**: ASP.NET Core 10 + Entity Framework Core + SQLite
- **Infrastructure**: Docker Compose + Caddy reverse proxy

## Repo Layout

```
backend/track-list-api/     ASP.NET Core API
backend/track-list-tests/   xUnit + Reqnroll tests (project file is TrackListTests.csproj)
frontend/                   SvelteKit application
features/                   Canonical BDD feature files (Ukrainian Gherkin)
seeder/                     Python seeder for demo data
docs/                       Install + self-host security docs
```

Directory names are lowercase; C# folders inside `track-list-api/` stay PascalCase because they
mirror namespaces.

## Commands — working directories matter

| Subsystem | Work from | Key commands |
|---|---|---|
| Frontend | `frontend/` | `pnpm dev`, `pnpm build`, `pnpm check`, `pnpm lint`, `pnpm test:unit`, `pnpm test:bdd` |
| Backend | `backend/track-list-api/` | `dotnet run`, `dotnet ef migrations add <Name>`, `dotnet ef database update` |
| Tests | repo root | `dotnet test backend/track-list-api.sln` |
| Docker | repo root | `docker compose -f docker-compose.dev.yaml up --build` (dev), `docker compose up --build -d` (prod) |

The frontend uses **pnpm 11** (`packageManager` field, `engine-strict=true` in `.npmrc`) — not npm.

## Architecture

### Request flow

- **Dev**: Browser → Caddy (:80) → `/api/*` → API (:8080) | everything else → Vite (:5173)
- **Prod**: Browser → Caddy (:80/:443) → `/api/*` → API (:8080) | everything else → SvelteKit Node (:3000)

Uploads live at `/app/uploads`, served by Caddy and shared between containers via a bind mount.

### Backend layers

```
Controller → Service → Repository → DbContext → SQLite
```

- **Repository pattern**: generic `Repository<T>` + `UnitOfWork` in `Repository/`
- **Services** (`Services/`): business logic — `AuthService`, `ReviewService`, `MediaGetService`,
  `FeedService`, `TmdbService`, `ExternalContentService`, `TranslationService`,
  `SanitizerService` (HTML sanitization of user content)
- **DTOs** (`DTOs/`): every API response uses a DTO; raw entities are never exposed
- **Validators** (`Validators/`): FluentValidation on all inbound request models
- **Middleware** (`Middleware/GlobalExceptionHandler.cs`): catches unhandled exceptions
- **Identity** (`Identity/`): JWT bearer auth; claims carried in the token, no server sessions

### Key data entities

| Entity | Notes |
|---|---|
| `User` | Role: USER / ADMIN / MODERATOR |
| `Media` | Non-text fields only (ExternalApiId/TMDB, type, year, poster URL) |
| `MediaTranslation` | Localized title + synopsis; status PENDING → APPROVED via moderator |
| `Review` | One per user per media; soft-deleted (`DeletedAt`) |
| `Comment` | Self-referencing `ParentCommentId` for nested replies; soft-deleted |
| `Playlist` | User collection (public/private); sharing via `PlaylistAccess` |
| `TrackingStatus` | PLAN_TO_WATCH / WATCHING / COMPLETED / DROPPED |
| `Report` | Flagged content; status PENDING → RESOLVED |
| `Follow` | Self-referencing users (follower → following); unique constraint |

Soft-deleted entities use a `DeletedAt` column with an EF Core global query filter defined in
`DbContext/` — all queries exclude them by default.

### Frontend structure

```
src/
  routes/         File-based SvelteKit pages (auth, profile, feed, media, admin…)
  lib/
    components/   Reusable Svelte UI components
    stores/       Global client state (auth, user, feed, language, breadcrumbs)
    server/       Server-side utilities (cookie/token helpers)
    types/        TypeScript interfaces mirroring backend DTOs
    utils/        Helper functions
  hooks.server.ts Server middleware: validates JWT on every SSR request
```

## BDD testing

Two intentionally different sets of Gherkin files — do not merge them:

- **`features/`** (repo root) — canonical, backend-oriented specifications. Consumed by the
  Reqnroll suite via `<Content Include="..\..\features\**\*.feature">` in `TrackListTests.csproj`.
- **`frontend/features/`** — narrowed, UI-scoped variants of the same scenarios plus
  frontend-only ones (e.g. `11-auth-e2e.feature`). Consumed by Cucumber.js via `cucumber.cjs`.

All feature files are written in Ukrainian (`language: uk` in the Gherkin header). Keep new
scenarios in Ukrainian to match.

## Configuration

Four `.env` files, all gitignored, each with a committed `.env.example`:

| File | Consumed by |
|---|---|
| `.env` | docker compose (api + web) |
| `backend/track-list-api/.env` | `dotnet run` / `dotnet test` outside Docker |
| `frontend/.env` | Vite dev server + SvelteKit SSR outside Docker |
| `seeder/.env` | Python seeder (`SEED_*` vars) |

The root `.env.example` header documents which variables overlap between files and how to rotate
them. `dotenv.net` loads `.env` in `Program.cs` automatically.

Key variables: `CONNECTION_STRING`, `JWT_PRIVATE_KEY` / `JWT_AUDIENCE` / `JWT_ISSUER`,
`FILE_STORAGE_PATH`, `PUBLIC_API_URL`, `TRACKLIST_SETUP_TOKEN`, `TRACKLIST_PUBLIC_REGISTRATION`,
and the `TRACKLIST_ENABLE_*` integration flags.

## Critical details

- **Self-host defaults are restrictive on purpose**: no default admin, public registration off,
  external integrations off. The first admin is created once via `/setup` with
  `TRACKLIST_SETUP_TOKEN`. Don't loosen these defaults casually.
- **Vite proxy** (`vite.config.ts`): in dev, `/api` calls go to `http://localhost:80` (Caddy), not
  straight to the API port.
- **Frontend tests**: Vitest config lives in `vite.config.ts` (jsdom env).
- **`pnpm check`** runs `svelte-kit sync && svelte-check` — should pass before tests.
- **Migrations** (`backend/track-list-api/Migrations/`) are committed and applied automatically on
  API startup.
- **Swagger** is served at `/swagger` in Development only; controllers should carry XML doc
  comments so the generated OpenAPI document stays useful.
- **No CI** is configured in this repository.

## Conventions

- **Formatting**: Prettier enforces tabs and a 100-char line width with the Svelte plugin. Run
  `pnpm lint` before committing frontend changes.
- **C# analysis**: SonarAnalyzer is active; fix new warnings it raises.
- **Logging**: Serilog with structured logging. Inject `ILogger<T>`; avoid `Console.Write`.
