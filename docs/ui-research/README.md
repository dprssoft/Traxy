# Competitor UI Research & Benchmark Report

This document compiles the benchmark screenshots and UI/UX analysis of key competitors across all entertainment media domains (Movies, TV Shows, Video Games, Anime, Manga, Books, and Comics).

All screenshots are stored locally in `docs/ui-research/<site-name>/` with both **Mobile (iPhone 14 / 393x852)** and **Desktop (1440x900)** viewports.

---

## 📁 Repository Directory Structure

```text
docs/ui-research/
├── letterboxd/          # Movies (Industry standard for logging, diary, reviews)
├── backloggd/           # Video Games (Play status, logs, custom lists)
├── anilist/             # Anime & Manga (Progress steppers, scoring, stats)
├── simkl/               # All-in-One (TV, Movies, Anime dashboard)
├── trakt/               # TV & Movies (Calendar, scrobbling, episode tracker)
├── howlongtobeat/       # Video Games (Completion times, tier breakdowns)
├── hardcover/           # Books (Modern book tracking, reading goal bars)
├── thestorygraph/       # Books (Deep reading statistics and mood tags)
└── leagueofcomicgeeks/  # Comics (Pull lists, issue tracking, variants)
```

---

## 🎯 Screen Analysis & Traxy Design Takeaways

### 1. 🎬 Letterboxd (Movies)
* **Folder:** [`docs/ui-research/letterboxd/`](file:///d:/projects/Traxy/docs/ui-research/letterboxd)
* **Key Patterns:**
  - **Poster-First Minimal Grid:** Strong emphasis on clean movie posters without distracting text labels on cards.
  - **Diary & Watched History:** Micro-icons for "Watched", "Liked", "In Watchlist", and star rating overlay.
  - **Review Feed:** User reviews prominently showcase rating distribution histogram and community comments.
* **Takeaway for Traxy:** In grid view, keep media cards clean and poster-centric with subtle status badges.

---

### 2. 🎮 Backloggd (Video Games)
* **Folder:** [`docs/ui-research/backloggd/`](file:///d:/projects/Traxy/docs/ui-research/backloggd)
* **Key Patterns:**
  - **Status Categories:** Distinct tabs for *Playing*, *Backlog*, *Completed*, *Paused*, *Dropped*, *Mastered*.
  - **Platform Selectors:** Clear badges showing which platform the game was played on (PC, PS5, Switch, etc.).
  - **Activity Timeline:** Log entries with playthrough dates, hours played, and completion type.
* **Takeaway for Traxy:** Allow multi-platform selection on game media pages and quick status toggle buttons.

---

### 3. 🌸 AniList (Anime & Manga)
* **Folder:** [`docs/ui-research/anilist/`](file:///d:/projects/Traxy/docs/ui-research/anilist)
* **Key Patterns:**
  - **Episode/Chapter Counter Stepper:** `+` / `-` incremental buttons for quick progress updating right from the list or detail modal.
  - **Score Systems:** Supports multiple scoring scales (10-point, 100-point, 5-star, 3-point smiley).
  - **Deep Visual Stats:** Distribution charts by genre, voice actors, studios, and release format.
* **Takeaway for Traxy:** Implement one-tap `+1 Episode` / `+1 Chapter` / `+10 Pages` progress buttons directly on tracking cards.

---

### 4. 📺 SIMKL (All-in-One Tracker)
* **Folder:** [`docs/ui-research/simkl/`](file:///d:/projects/Traxy/docs/ui-research/simkl)
* **Key Patterns:**
  - **Unified Navigation Bar:** Easy switching between TV Shows, Anime, and Movies tabs.
  - **Next Up & Countdown:** Displays which episode is next to watch and release countdowns for upcoming air dates.
* **Takeaway for Traxy:** Provide a "Next Up to Consume" carousel on the home dashboard across active media.

---

### 5. ⏱️ HowLongToBeat (Video Games)
* **Folder:** [`docs/ui-research/howlongtobeat/`](file:///d:/projects/Traxy/docs/ui-research/howlongtobeat)
* **Key Patterns:**
  - **Three-Tier Time Breakdown:** *Main Story*, *Main + Extra*, *Completionist* average hours.
  - **Color-Coded Badges:** High contrast visual blocks for quick scanning.
* **Takeaway for Traxy:** Show HLTB completion time badges directly on video game detail screens.

---

### 6. 📚 Hardcover & The StoryGraph (Books)
* **Folders:** [`docs/ui-research/hardcover/`](file:///d:/projects/Traxy/docs/ui-research/hardcover), [`docs/ui-research/thestorygraph/`](file:///d:/projects/Traxy/docs/ui-research/thestorygraph)
* **Key Patterns:**
  - **Reading Progress Bar:** Percentage and page number slider (e.g., `Page 180 of 420 (43%)`).
  - **Mood & Pacing Tags:** Visual tags describing book tone (e.g., *Fast-paced*, *Dark*, *Reflective*).
* **Takeaway for Traxy:** Include progress percentage bars and custom mood/genre chip filters.

---

### 7. 🦸 League of Comic Geeks (Comics)
* **Folder:** [`docs/ui-research/leagueofcomicgeeks/`](file:///d:/projects/Traxy/docs/ui-research/leagueofcomicgeeks)
* **Key Patterns:**
  - **Weekly Pull List / Release Calendar:** Organized by release Wednesday with cover variant selectors.
  - **Series Issue Checklist:** Visual grid of issue #1..#N with checkmark overlays for read/owned issues.
* **Takeaway for Traxy:** Add issue checklist grid for comic and manga volumes.
