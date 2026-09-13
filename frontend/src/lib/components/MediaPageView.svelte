<script lang="ts">
	import { untrack } from 'svelte';
	import type { LocalMedia } from '$lib/types/mediaTypes';
	import type { LocalTrackingStatus, LocalWatchCycle } from '$lib/types/trackingTypes';
	import ProgressTracker from './ProgressTracker.svelte';
	import CycleHistory from './CycleHistory.svelte';
	import StarRating from './StarRating.svelte';
	import TrackModal from './TrackModal.svelte';
	import AddToCollectionModal from './AddToCollectionModal.svelte';
	import { MEDIA_TYPE_LABELS, getStatusLabel } from '$lib/constants';
	import { updateScore, updateNote, getTracking, upsertTracking } from '$lib/db/services/tracking.service';
	import { getCycles } from '$lib/db/services/cycle.service';
	import { recordVisitedMedia } from '$lib/db/services/catalogue.service';
	import { getDb } from '$lib/db/index';
	import { DEFAULT_COLLECTION_NAME } from '$lib/constants';
	import { v4 as uuidv4 } from 'uuid';
	import { MarqueeText } from '$lib/components/ui';

	interface Props {
		media: LocalMedia;
		tracking: LocalTrackingStatus | null;
		cycles: LocalWatchCycle[];
		showCountryFlags?: boolean;
	}

	let { media, tracking: initialTracking, cycles: initialCycles, showCountryFlags = false }: Props = $props();

	// tracking and cycles are written locally (by handlers) AND synced from props
	// eslint-disable-next-line svelte/prefer-writable-derived
	let tracking = $state<LocalTrackingStatus | null>(untrack(() => initialTracking));
	// eslint-disable-next-line svelte/prefer-writable-derived
	let cycles = $state<LocalWatchCycle[]>(untrack(() => initialCycles));

	$effect(() => { tracking = initialTracking; });
	$effect(() => { cycles = initialCycles; });

	// UI state
	let descExpanded = $state(false);
	let showTrackModal = $state(false);
	let showCollectionModal = $state(false);
	let isFavorite = $state(false);
	let favoriteLoading = $state(false);
	let shareCopied = $state(false);

	// User note (item 14)
	// eslint-disable-next-line svelte/prefer-writable-derived
	let userNote = $state(untrack(() => initialTracking?.note ?? ''));
	let noteSaved = $state(false);

	$effect(() => {
		userNote = tracking?.note ?? '';
	});

	$effect(() => {
		if (media) {
			recordVisitedMedia(media);
		}
	});

	// Load favorite state
	$effect(() => {
		checkIsFavorite(media.id);
	});

	// -------------------------------------------------------------------------
	// Favorites (Item 15)
	// -------------------------------------------------------------------------

	async function getFavoritesCollectionId(): Promise<string> {
		const db = getDb();
		const result = await db.query('SELECT id FROM Collection WHERE name = ? LIMIT 1', [
			DEFAULT_COLLECTION_NAME,
		]);
		if (result.values && result.values.length > 0) {
			const row = result.values[0] as string[] | Record<string, string>;
			return Array.isArray(row) ? row[0] : row['id'];
		}
		const id = uuidv4();
		const now = new Date().toISOString();
		await db.run(
			'INSERT INTO Collection (id, name, description, createdAt) VALUES (?, ?, ?, ?)',
			[id, DEFAULT_COLLECTION_NAME, 'My favorite media', now],
		);
		return id;
	}

	async function checkIsFavorite(mediaId: string) {
		try {
			const db = getDb();
			const result = await db.query(
				`SELECT ci.mediaId FROM CollectionItem ci
				 JOIN Collection c ON c.id = ci.collectionId
				 WHERE c.name = ? AND ci.mediaId = ? LIMIT 1`,
				[DEFAULT_COLLECTION_NAME, mediaId],
			);
			isFavorite = !!(result.values && result.values.length > 0);
		} catch {
			isFavorite = false;
		}
	}

	async function toggleFavorite() {
		if (favoriteLoading) return;
		favoriteLoading = true;
		try {
			const db = getDb();
			const collId = await getFavoritesCollectionId();
			if (isFavorite) {
				await db.run(
					'DELETE FROM CollectionItem WHERE collectionId = ? AND mediaId = ?',
					[collId, media.id],
				);
				isFavorite = false;
			} else {
				const now = new Date().toISOString();
				await db.run(
					'INSERT OR IGNORE INTO CollectionItem (id, collectionId, mediaId, sortOrder, addedAt) VALUES (?, ?, ?, ?, ?)',
					[uuidv4(), collId, media.id, 0, now],
				);
				isFavorite = true;
			}
		} catch (err) {
			console.error('Failed to toggle favorite', err);
		} finally {
			favoriteLoading = false;
		}
	}

	// -------------------------------------------------------------------------
	// Share (Item 16)
	// -------------------------------------------------------------------------

	function handleShare() {
		if (navigator.share) {
			navigator
				.share({ title: media.title, url: window.location.href })
				.catch(() => {});
		} else {
			navigator.clipboard?.writeText(window.location.href).then(() => {
				shareCopied = true;
				setTimeout(() => { shareCopied = false; }, 2000);
			}).catch(() => {});
		}
	}

	// -------------------------------------------------------------------------
	// Tracking & Scores
	// -------------------------------------------------------------------------

	async function handleTrackingChanged(t: LocalTrackingStatus | null) {
		tracking = t;
		if (t) {
			const c = await getCycles(media.id);
			cycles = c;
		} else {
			cycles = [];
		}
	}

	async function handleScore(score: number) {
		// Half-star = 1 increment; score 1–10
		const target = tracking?.score === score ? null : score;
		const updated = await updateScore(media.id, target);
		tracking = updated;
	}

	async function handleSaveNote() {
		if (!tracking) {
			const updated = await upsertTracking({
				mediaId: media.id,
				status: 'planned',
				note: userNote.trim(),
			});
			tracking = updated;
		} else {
			await updateNote(media.id, userNote.trim());
			tracking = { ...tracking, note: userNote.trim() };
		}
		noteSaved = true;
		setTimeout(() => { noteSaved = false; }, 2000);
	}

	// -------------------------------------------------------------------------
	// Derived metadata helpers matching wireframe
	// -------------------------------------------------------------------------

	function formatRuntime(min: number): string {
		if (!min || min <= 0) return '—';
		const h = Math.floor(min / 60);
		const m = min % 60;
		if (h > 0) return `${h}h ${m}m`;
		return `${m}m`;
	}

	// Item 1: media.title
	// Item 2: media.originalTitle (if not English / different)
	const displayOriginalTitle = $derived(
		media.originalTitle && media.originalTitle !== media.title ? media.originalTitle : null,
	);

	// Item 3: Year or Year/Months serialization
	const displayYear = $derived(
		media.serializationYears || (media.year ? `${media.year}` : '—'),
	);

	// Item 4: Author (Director / Author / Developer / Creator)
	const authorLabel = $derived(
		media.type === 'film' ? 'Director' :
		media.type === 'tv' || media.type === 'anime' ? 'Creator' :
		media.type === 'game' ? 'Studio' :
		media.type === 'book' ? 'Author' :
		media.type === 'manga' || media.type === 'manhwa' || media.type === 'manhua' ? 'Mangaka' :
		media.type === 'comic' ? 'Publisher' : 'Author',
	);
	const displayAuthor = $derived(
		media.author || '—',
	);

	// Item 5: Country of origin
	// Build a reverse map: English country name -> ISO 3166-1 alpha-2 code (for flag emoji)
	// We use Intl.DisplayNames to go name->code by iterating all ~250 ISO codes.
	function countryNameToFlag(name: string): string | null {
		if (typeof Intl === 'undefined' || !Intl.DisplayNames) return null;
		const normalised = name.toLowerCase().trim();
		// Fast-path aliases for non-standard names Wikidata/TMDB might return
		const aliases: Record<string, string> = {
			'united states of america': 'US',
			'usa': 'US',
			'us': 'US',
			'uk': 'GB',
			'great britain': 'GB',
			'people\'s republic of china': 'CN',
			'republic of korea': 'KR',
			'republic of china': 'TW',
			'russian federation': 'RU',
		};
		if (aliases[normalised]) {
			const code = aliases[normalised];
			return String.fromCodePoint(...[...code].map(c => 0x1F1E6 + c.charCodeAt(0) - 65));
		}
		// Search all ISO 3166-1 alpha-2 codes via Intl.DisplayNames
		try {
			const dn = new Intl.DisplayNames(['en'], { type: 'region' });
			// There are only 26^2 = 676 possible 2-letter codes, most are invalid
			// In practice we only need to check the ~250 valid ones — but iterating all is fast
			for (let i = 65; i <= 90; i++) {
				for (let j = 65; j <= 90; j++) {
					const code = String.fromCharCode(i, j);
					try {
						const label = dn.of(code);
						if (label && label.toLowerCase() === normalised) {
							return String.fromCodePoint(...[...code].map(c => 0x1F1E6 + c.charCodeAt(0) - 65));
						}
					} catch { /* invalid code, skip */ }
				}
			}
		} catch { /* Intl not available */ }
		return null;
	}

	const displayCountry = $derived((() => {
		const c = media.country ||
			(media.type === 'anime' || media.type === 'manga' ? 'Japan' :
			 media.type === 'manhwa' ? 'South Korea' :
			 media.type === 'manhua' ? 'China' : '—');
		if (c !== '—' && showCountryFlags) {
			const flag = countryNameToFlag(c);
			if (flag) return flag;
		}
		return c;
	})());

	// Item 7: Genres (up to 3)
	const displayGenres = $derived((() => {
		if (media.genres && media.genres.length > 0) {
			return media.genres.slice(0, 3);
		}
		if (media.type === 'game' && media.platforms && media.platforms.length > 0) {
			return media.platforms.slice(0, 3);
		}
		if (media.type === 'anime') return ['Animation', 'Action'];
		if (media.type === 'manga') return ['Manga', 'Drama'];
		if (media.type === 'film') return ['Cinema', 'Feature'];
		if (media.type === 'tv') return ['Series', 'Drama'];
		if (media.type === 'book') return ['Literature'];
		return [];
	})());

	// Item 9: Status (airing; finished; hiatus; axed etc) — NEVER show tracking status here
	const mediaStatusText = $derived((() => {
		if (media.releaseStatus) {
			return media.releaseStatus.charAt(0).toUpperCase() + media.releaseStatus.slice(1).toLowerCase();
		}
		// Type-based default when no release status is known
		if (media.type === 'film') return 'Released';
		if (media.type === 'game') return 'Released';
		if (media.type === 'book') return 'Published';
		if (media.type === 'tv' || media.type === 'anime') return '—';
		return '—';
	})());

	// Item 10: Seasons/Episodes, Volumes/Chapters, Pages, Time to beat
	const ttb = $derived((() => {
		if (media.type !== 'game' || !media.timeToBeat) return null;
		try {
			return JSON.parse(media.timeToBeat) as { main: number; extra: number; completionist: number };
		} catch {
			return null;
		}
	})());

	const mediaCountText = $derived((() => {
		if (media.type === 'game') {
			if (ttb?.main) return `${ttb.main}h`;
			return '—';
		}
		if (media.type === 'book') {
			return media.totalPages ? `${media.totalPages} p.` : '—';
		}
		if (media.type === 'manga' || media.type === 'manhwa' || media.type === 'manhua' || media.type === 'comic') {
			if (media.totalVolumes && media.totalChapters) {
				return `${media.totalVolumes}v · ${media.totalChapters}ch`;
			}
			if (media.totalChapters) return `${media.totalChapters} ch.`;
			if (media.totalVolumes) return `${media.totalVolumes} vol.`;
			return '—';
		}
		if (media.type === 'tv' || media.type === 'anime') {
			if (media.type === 'anime' && media.runtimeMinutes && !media.totalEpisodes) {
				return formatRuntime(media.runtimeMinutes);
			}
			if (media.totalSeasons && media.totalEpisodes) {
				return `${media.totalSeasons}s · ${media.totalEpisodes}ep`;
			}
			if (media.totalEpisodes) return `${media.totalEpisodes} ep.`;
			if (media.totalSeasons) return `${media.totalSeasons} season`;
			return '—';
		}
		if (media.type === 'film') {
			if (media.runtimeMinutes) return formatRuntime(media.runtimeMinutes);
			return media.year ? `${media.year}` : '—';
		}
		return '—';
	})());

	// Item 12: Track button label
	const trackButtonLabel = $derived(
		tracking ? getStatusLabel(tracking.status, media.type) : 'Track',
	);
</script>

<!-- =========================================================================
     Media Page Layout
     Matches exact wireframe layout with hidden top header
     ========================================================================= -->
<div class="flex flex-col min-h-full max-w-2xl mx-auto pb-6">

	<!-- ── Top Action Bar (Replacing main header) ────────────────────────── -->
	<header class="sticky top-0 z-30 bg-[#0a0b12]/95 backdrop-blur-md border-b border-white/[0.06] px-3.5 sm:px-6 py-2.5 flex items-center justify-between">
		<!-- Back button -->
		<button
			type="button"
			onclick={() => history.back()}
			class="w-10 h-10 flex items-center justify-center rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] text-slate-300 hover:text-white transition-all active:scale-95 cursor-pointer"
			aria-label="Go back"
		>
			<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
				<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
			</svg>
		</button>

		<div class="flex items-center gap-2">
			<!-- 15. Add to favorite -->
			<button
				type="button"
				onclick={toggleFavorite}
				disabled={favoriteLoading}
				class="w-10 h-10 flex items-center justify-center rounded-xl border transition-all active:scale-95 cursor-pointer
					{isFavorite
						? 'bg-rose-500/20 border-rose-500/30 text-rose-400'
						: 'bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] text-slate-400 hover:text-rose-400'}"
				aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
			>
				{#if isFavorite}
					<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
						<path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
					</svg>
				{:else}
					<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
					</svg>
				{/if}
			</button>

			<!-- 16. Share (to be implemented) -->
			<button
				type="button"
				onclick={handleShare}
				class="relative w-10 h-10 flex items-center justify-center rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] text-slate-400 hover:text-white transition-all active:scale-95 cursor-pointer"
				aria-label="Share"
			>
				<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
				</svg>
				{#if shareCopied}
					<span class="absolute -bottom-7 right-0 text-[10px] font-bold bg-indigo-600 text-white px-2 py-0.5 rounded shadow">
						Copied!
					</span>
				{/if}
			</button>
		</div>
	</header>

	<!-- ── Main Wireframe 2-Column Body ───────────────────────────────────── -->
	<div class="grid grid-cols-[145px_1fr] sm:grid-cols-[210px_1fr] md:grid-cols-[240px_1fr] gap-3.5 sm:gap-6 p-3.5 sm:p-6">

		<!-- ═══════════════════════════════════════════════════════════
		     LEFT COLUMN: Poster, Status/Episodes, Stars, Track,
		     Add to collection, Note
		     ═══════════════════════════════════════════════════════════ -->
		<div class="flex flex-col gap-3 min-w-0">

			<!-- Media Poster (or backup image) -->
			<div class="w-full aspect-[2/3] rounded-2xl overflow-hidden bg-[#16192b] border border-white/[0.08] shadow-xl relative">
				{#if media.posterUrl}
					<img
						src={media.posterUrl}
						alt={media.title}
						class="w-full h-full object-cover"
					/>
				{:else}
					<!-- Backup / Placeholder image -->
					<div class="w-full h-full flex flex-col items-center justify-center p-3 text-center bg-gradient-to-br from-[#1b1f35] to-[#101322]">
						<span class="text-3xl opacity-50 mb-1">
							{media.type === 'game' ? '🎮' : media.type === 'book' ? '📖' : media.type === 'film' ? '🎬' : media.type === 'tv' ? '📺' : '📚'}
						</span>
						<span class="text-slate-400 font-bold text-xs line-clamp-2">{media.title}</span>
					</div>
				{/if}
			</div>

			<!-- 9. Status & 10. Seasons/Episodes OR Time to Beat for Games -->
			{#if media.type === 'game' && ttb}
				<div class="flex flex-col gap-1 mt-1 bg-[#16192b]/80 rounded-xl p-2.5 border border-white/[0.08]">
					<div class="flex justify-between items-center text-[10px]">
						<span class="text-slate-400 font-bold uppercase tracking-wider">Main Story</span>
						<span class="text-indigo-400 font-bold">{ttb.main ? `${ttb.main}h` : '--'}</span>
					</div>
					<div class="flex justify-between items-center text-[10px]">
						<span class="text-slate-400 font-bold uppercase tracking-wider">+ Extras</span>
						<span class="text-fuchsia-400 font-bold">{ttb.extra ? `${ttb.extra}h` : '--'}</span>
					</div>
					<div class="flex justify-between items-center text-[10px]">
						<span class="text-slate-400 font-bold uppercase tracking-wider">Completionist</span>
						<span class="text-purple-400 font-bold">{ttb.completionist ? `${ttb.completionist}h` : '--'}</span>
					</div>
				</div>
			{:else}
				<div class="flex items-center justify-between gap-1 text-[11px] font-bold px-0.5">
					<span class="text-slate-300 truncate" title={mediaStatusText}>
						{mediaStatusText}
					</span>
					<span class="text-slate-500 truncate" title={mediaCountText}>
						{mediaCountText}
					</span>
				</div>
			{/if}

			<!-- 11. User rating (5 stars divided by half, score up to 10) -->
			<div class="flex flex-col items-center sm:items-start gap-1">
				<StarRating
					value={tracking?.score ?? 0}
					interactive={true}
					size="md"
					onchange={handleScore}
				/>
				<div class="text-[10px] font-bold">
					{#if tracking?.score}
						<span class="text-amber-400">{tracking.score}/10</span>
					{:else}
						<span class="text-slate-500">Tap to rate</span>
					{/if}
				</div>
			</div>

			<!-- 12. Track (when clicked - new window opens [12.1]) -->
			<button
				type="button"
				onclick={() => (showTrackModal = true)}
				class="w-full py-2.5 px-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-xl text-xs sm:text-sm shadow-md shadow-indigo-600/20 transition-all active:scale-95 cursor-pointer text-center truncate"
			>
				{trackButtonLabel}
			</button>

			<!-- 13. Add to collection (modal window opens with user collections) -->
			<button
				type="button"
				onclick={() => (showCollectionModal = true)}
				class="w-full py-2.5 px-3 bg-[#16192b] hover:bg-[#1f243d] border border-white/[0.08] hover:border-white/[0.16] text-slate-300 hover:text-white font-semibold text-xs sm:text-sm rounded-xl transition-all active:scale-95 cursor-pointer text-center truncate"
			>
				Add To Collection
			</button>

			<!-- 14. User note (with 255 character limit) -->
			<div class="relative bg-[#16192b]/80 border border-white/[0.08] hover:border-white/[0.16] rounded-xl p-2.5 transition-all">
				<div class="flex items-center justify-between mb-1">
					<span class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Note</span>
					{#if noteSaved}
						<span class="text-[10px] text-emerald-400 font-semibold">Saved ✓</span>
					{/if}
				</div>
				<textarea
					bind:value={userNote}
					maxlength={255}
					onblur={handleSaveNote}
					placeholder="User note..."
					rows="3"
					class="w-full bg-transparent text-xs text-slate-200 placeholder-slate-500 resize-none outline-none leading-relaxed"
				></textarea>
				<div class="text-right text-[10px] text-slate-500 font-mono select-none">
					{userNote.length}/255
				</div>
			</div>
		</div>

		<!-- ═══════════════════════════════════════════════════════════
		     RIGHT COLUMN: Title 1, Title 2, Year 3, Author 4, Country 5,
		     Type 6, Genre 7, Media Description 8 (expandable)
		     ═══════════════════════════════════════════════════════════ -->
		<div class="flex flex-col gap-2 min-w-0">

			<!-- 1. Media Title (on APP language) -->
			<h1 class="text-base sm:text-2xl font-extrabold text-white leading-tight tracking-tight line-clamp-3">
				{media.title}
			</h1>

			<!-- 2. Original Media Title (if not English / different) -->
			{#if displayOriginalTitle}
				<p class="text-xs sm:text-sm text-slate-400 font-medium italic -mt-1 line-clamp-1">
					{displayOriginalTitle}
				</p>
			{/if}

			<!-- 3. Year, 4. Author, 5. Country of origin -->
			<div class="grid grid-cols-3 gap-1.5 sm:gap-3 py-2 my-1 border-y border-white/[0.06] text-center">
				<div class="flex flex-col min-w-0">
					<span class="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Year</span>
					<span class="text-xs font-semibold text-slate-200 truncate" title={displayYear}>
						{displayYear}
					</span>
				</div>
				<div class="flex flex-col min-w-0">
					<span class="text-[10px] uppercase font-bold text-slate-500 tracking-wider">{authorLabel}</span>
					<MarqueeText class="text-xs font-semibold text-slate-200" title={displayAuthor} text={displayAuthor} />
				</div>
				<div class="flex flex-col min-w-0">
					<span class="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Country</span>
					<MarqueeText class="text-xs font-semibold text-slate-200" title={displayCountry} text={displayCountry} />
				</div>
			</div>

			<!-- 6. Media type & 7. Genre (up to 3) -->
			<div class="flex flex-wrap gap-1.5 my-0.5">
				<!-- Type badge -->
				<span class="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] sm:text-xs font-bold rounded-md uppercase tracking-wider">
					{MEDIA_TYPE_LABELS[media.type] ?? media.type}
				</span>

				<!-- Genre badges -->
				{#each displayGenres as genre (genre)}
					<span class="px-2 py-0.5 bg-[#181b2e] border border-white/[0.08] text-slate-300 text-[10px] sm:text-xs rounded-md font-medium">
						{genre}
					</span>
				{/each}
			</div>

			<!-- 8. Media description (expandable) -->
			<div class="flex flex-col gap-1.5 mt-2">
				<h2 class="text-xs sm:text-sm font-bold text-slate-200 uppercase tracking-wider">
					Media Description
				</h2>
				<div
					class="relative text-xs sm:text-sm text-slate-300 leading-relaxed overflow-hidden transition-all duration-300"
					style="max-height: {descExpanded ? '800px' : '96px'}"
				>
					<p class="whitespace-pre-line leading-relaxed">
						{media.description || 'No description available for this title.'}
					</p>

					<!-- Fade gradient when collapsed -->
					{#if !descExpanded && (media.description?.length ?? 0) > 100}
						<div class="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-[var(--color-bkg-main,#0a0b12)] to-transparent pointer-events-none"></div>
					{/if}
				</div>

				<!-- Expandable chevron toggle (V) -->
				{#if (media.description?.length ?? 0) > 100}
					<button
						type="button"
						onclick={() => (descExpanded = !descExpanded)}
						class="flex items-center justify-center w-full py-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
						aria-label={descExpanded ? 'Collapse description' : 'Expand description'}
					>
						<svg
							class="w-5 h-5 transition-transform duration-300 {descExpanded ? 'rotate-180' : ''}"
							fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"
						>
							<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
						</svg>
					</button>
				{/if}
			</div>

		</div>
	</div>

	<!-- ── Scrollable detail section: ProgressTracker & CycleHistory ─────── -->
	{#if tracking}
		<div class="px-3.5 sm:px-6 flex flex-col gap-4 mt-2">
			<ProgressTracker {media} {tracking} onUpdate={handleTrackingChanged} />
			<CycleHistory {media} {cycles} onComplete={async () => {
				const updated = await getTracking(media.id);
				if (updated) tracking = updated;
			}} />
		</div>
	{/if}
</div>

<!-- ── Window [12.1]: Track Modal ────────────────────────────────────── -->
{#if showTrackModal}
	<TrackModal
		{media}
		{tracking}
		onTrackingChanged={handleTrackingChanged}
		onClose={() => (showTrackModal = false)}
	/>
{/if}

<!-- ── Window [13]: Add to Collection Modal ──────────────────────────── -->
{#if showCollectionModal}
	<AddToCollectionModal
		mediaId={media.id}
		onClose={() => (showCollectionModal = false)}
	/>
{/if}