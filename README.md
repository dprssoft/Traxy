<div align="center">
  <h1>Traxy</h1>
  <p><b>Personal, Local-First Multimedia Experience Tracking</b></p>

  <!-- Badges -->
  <img src="https://img.shields.io/badge/SvelteKit-FF3E00?style=for-the-badge&logo=Svelte&logoColor=white" alt="SvelteKit" />
  <img src="https://img.shields.io/badge/Capacitor-119EFF?style=for-the-badge&logo=Capacitor&logoColor=white" alt="Capacitor" />
  <img src="https://img.shields.io/badge/Android-3DDC84?style=for-the-badge&logo=Android&logoColor=white" alt="Android" />
  <img src="https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white" alt="SQLite" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="MIT License" />
</div>

<br />

## 📋 About The Project

**Traxy** is a modern, privacy-focused, local-first application designed to organize and track all your multimedia in one place: **Films, TV Series, Video Games, Anime, Manga, Books, and Comics**.

Everything runs directly on your device. Your data is stored in a **local SQLite database**—no servers, no third-party tracking, no cloud dependencies.

Available as both a **Web application** and a **Native Android app**.

---

## 🚀 Key Features

- **Universal Tracking:** Manage your lists (*Planned*, *In Progress*, *Completed*, *Dropped*, *Paused*) across all media types.
- **Detailed Progress:** Track watched episodes, seasons, completed game hours/tiers (*Main Story*, *Completionist*), read pages, and comic issues.
- **Comprehensive Search & Metadata:**
  - 🎬 **Movies & TV:** Powered by [The Movie Database (TMDB)](https://www.themoviedb.org/)
  - 🎮 **Video Games:** Powered by [IGDB](https://www.igdb.com/) (supports modern and retro platforms)
  - 📚 **Comics:** Powered by [ComicVine](https://comicvine.gamespot.com/)
  - 🌸 **Anime & Manga:** Powered by [AniList](https://anilist.co/)
  - 📖 **Books:** Powered by [Open Library](https://openlibrary.org/)
- **Custom Collections:** Create custom lists, tier lists, or thematic collections.
- **Personal Journal & Notes:** Write private reflections, notes, and cycle replays/rewatches.
- **Statistics & Analytics:** Beautiful charts and heatmaps visualizing your activity over time.
- **Data Ownership & Backup:** Export and import your entire database in JSON at any time with one click.

---

## 🛠️ Tech Stack

- **Framework:** SvelteKit 2 + Svelte 5 (Runes) + TypeScript
- **Styling:** Tailwind CSS 4
- **Database:** Local SQLite (via `@capacitor-community/sqlite` on Android & `jeep-sqlite` / WASM on Web)
- **Mobile Engine:** Capacitor 8
- **Charts:** Chart.js

---

## 📂 Project Structure

```text
Traxy/
├── frontend/
│   ├── src/
│   │   ├── lib/
│   │   │   ├── components/       # Reusable Svelte 5 UI components
│   │   │   ├── db/               # Local SQLite schema, migrations & services
│   │   │   │   └── sources/      # API integrations (TMDB, IGDB, ComicVine, etc.)
│   │   │   └── stores/           # Svelte runes stores (Goals, API Keys, Breadcrumbs)
│   │   └── routes/               # File-based SvelteKit pages
│   ├── android/                  # Native Android project (Capacitor)
│   ├── static/                   # Static assets & icons
│   └── capacitor.config.ts       # Capacitor native configuration
├── Caddyfile                     # Optional web reverse proxy
├── docker-compose.yaml           # Optional Docker container for web hosting
└── start-local.ps1               # Quickstart development script
```

---

## 💻 Getting Started

### Prerequisites

- [Node.js ≥ 22](https://nodejs.org/)
- `pnpm` (install with `corepack enable` or `npm install -g pnpm`)
- (Optional for Android builds) JDK 21 and Android Studio / Android SDK

### Running Web Locally

```bash
cd frontend
pnpm install
pnpm dev
```
Open **http://localhost:5173** in your browser.

### Building for Android

```bash
cd frontend
pnpm build
npx cap sync
cd android
./gradlew assembleDebug
```
The compiled APK will be located at:
`frontend/android/app/build/outputs/apk/debug/app-debug.apk`

---

## 🔑 API Keys Setup

Traxy works right out of the box for Anime, Manga, and Books without any API keys.

For Movies, Games, and Comics, you can enter your own free API keys directly inside the app under **Settings → API Keys**:
- **TMDB Key:** Free at [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api)
- **IGDB Credentials:** Free at [dev.twitch.tv/console](https://dev.twitch.tv/console)
- **ComicVine Key:** Free at [comicvine.gamespot.com/api](https://comicvine.gamespot.com/api/)

*All keys are stored securely in your device's local storage and are never sent to external servers.*

---

## 📄 License

Released under the [MIT License](LICENSE).
