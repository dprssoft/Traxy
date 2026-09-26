/**
 * Merges AniList anime stored one item per season into one item per series
 * (feat_merge_anime_seasons). The series item is keyed on the first season's AniList ID
 * and tracked like a TV show: one absolute episode counter across seasons.
 *
 * Before each run the whole database is saved to AppSettings so the merge can be undone.
 * A series whose data can't be fetched is skipped and retried on a later run.
 */
import { getDb } from '../index';
import type { LocalMedia, MediaMetaPatch } from '$lib/types/mediaTypes';
import type { LocalTrackingStatus } from '$lib/types/trackingTypes';
import type { TrackingStatusType } from '$lib/db/schema';
import {
	getAnilistSeriesDetails,
	resolveAnilistSeriesChain,
	type AnilistSeriesNode,
} from '../sources/anilist';
import { exportDatabaseJson, importDatabaseJson } from './backup.service';
import { rowToMedia, updateMediaMeta } from './media.service';
import { getTracking } from './tracking.service';
import {
	addAnimeSeriesIds,
	clearAnimeSeriesIds,
	getAnimeSeriesIds,
	getAppSetting,
	getAppSettingBool,
	setAppSetting,
	setAppSettingBool,
	setMergeAnimeSeasonsEnabled,
} from './settings.service';

const BACKUP_KEY = 'anime_merge_backup';
const PENDING_KEY = 'anime_merge_pending';

export interface SeasonTracking {
	/** 0-based position of the season in the chain. */
	seasonIndex: number;
	tracking: LocalTrackingStatus;
}

export type MergedTracking = Omit<LocalTrackingStatus, 'id' | 'mediaId'>;

function mergedStatus(seasons: SeasonTracking[], lastSeasonIndex: number): TrackingStatusType {
	const statuses = seasons.map((s) => s.tracking.status);
	const any = (status: TrackingStatusType) => statuses.includes(status);
	if (any('in_progress')) return 'in_progress';
	if (statuses.every((s) => s === 'completed')) {
		// Finishing earlier seasons only means the series is under way
		return seasons.some((s) => s.seasonIndex === lastSeasonIndex) ? 'completed' : 'in_progress';
	}
	if (any('paused')) return 'paused';
	if (any('completed')) return 'in_progress';
	if (any('dropped')) return 'dropped';
	if (any('watched_letsplay')) return 'watched_letsplay';
	return 'planned';
}

/**
 * Combine per-season tracking into one series record: furthest progress as an absolute
 * episode, a combined status, the most recently updated score, all notes (labelled by
 * season), the earliest start and the latest update.
 */
export function mergeSeasonTracking(
	chain: AnilistSeriesNode[],
	seasons: SeasonTracking[],
): MergedTracking {
	let furthest = 0;
	let currentSeason = 1;
	for (const { seasonIndex, tracking } of seasons) {
		const seasonEpisodes = chain[seasonIndex]?.episodes ?? 0;
		let watched = tracking.currentEpisode ?? 0;
		if (tracking.status === 'completed') watched = Math.max(watched, seasonEpisodes);
		if (watched <= 0) continue;
		const before = chain.slice(0, seasonIndex).reduce((sum, n) => sum + n.episodes, 0);
		if (before + watched > furthest) {
			furthest = before + watched;
			currentSeason = seasonIndex + 1;
		}
	}

	const byUpdate = [...seasons].sort((a, b) =>
		b.tracking.updatedAt.localeCompare(a.tracking.updatedAt),
	);
	const notes = [...seasons]
		.sort((a, b) => a.seasonIndex - b.seasonIndex)
		.filter((s) => s.tracking.note?.trim());

	return {
		status: mergedStatus(seasons, chain.length - 1),
		score: byUpdate.find((s) => s.tracking.score != null)?.tracking.score,
		note:
			notes.length === 1
				? notes[0].tracking.note
				: notes.map((s) => `S${s.seasonIndex + 1}: ${s.tracking.note!.trim()}`).join('\n\n') ||
					undefined,
		currentEpisode: furthest || undefined,
		currentSeason: furthest ? currentSeason : undefined,
		createdAt: seasons.map((s) => s.tracking.createdAt).sort()[0],
		updatedAt: byUpdate[0].tracking.updatedAt,
	};
}

async function writeTracking(targetId: string, merged: MergedTracking, rowId: string) {
	await getDb().run(
		`UPDATE TrackingStatus SET mediaId = ?, status = ?, score = ?, note = ?, currentEpisode = ?,
			currentSeason = ?, createdAt = ?, updatedAt = ? WHERE id = ?`,
		[
			targetId,
			merged.status,
			merged.score ?? null,
			merged.note ?? null,
			merged.currentEpisode ?? null,
			merged.currentSeason ?? null,
			merged.createdAt,
			merged.updatedAt,
			rowId,
		],
	);
}

/**
 * Express an already-merged series' tracking (absolute episode) as season-relative
 * progress, so it can be merged with newly added season items.
 */
export function seriesTrackingAsSeason(
	chain: AnilistSeriesNode[],
	tracking: LocalTrackingStatus,
): SeasonTracking {
	if (tracking.status === 'completed') return { seasonIndex: chain.length - 1, tracking };
	const seasonIndex = Math.min(Math.max((tracking.currentSeason ?? 1) - 1, 0), chain.length - 1);
	const before = chain.slice(0, seasonIndex).reduce((sum, n) => sum + n.episodes, 0);
	const currentEpisode = tracking.currentEpisode ? tracking.currentEpisode - before : undefined;
	return { seasonIndex, tracking: { ...tracking, currentEpisode } };
}

/** Fold `members` (season items of one series) into a single series item. */
async function mergeSeries(
	chain: AnilistSeriesNode[],
	members: LocalMedia[],
	seriesIds: Set<string>,
): Promise<boolean> {
	const db = getDb();
	const rootId = String(chain[0].id);
	const details = await getAnilistSeriesDetails(chain[0].id);
	if (!details) return false;

	const target = members.find((m) => m.externalId === rootId) ?? members[0];
	const others = members.filter((m) => m.id !== target.id);

	// 1. Series metadata on the target (non-empty provider values only)
	const meta: MediaMetaPatch = {
		totalEpisodes: details.totalEpisodes ?? null,
		totalSeasons: details.totalSeasons,
		seasonData: details.seasonData,
		releaseStatus: details.releaseStatus,
		// Wikidata re-checks against the series title on next open
		wikiMeta: null,
	};
	if (target.externalId !== rootId) {
		Object.assign(meta, {
			title: details.title,
			originalTitle: details.originalTitle,
			year: details.year,
			posterUrl: details.posterUrl,
			description: details.description,
		});
		await db.run('UPDATE Media SET externalId = ? WHERE id = ?', [rootId, target.id]);
	}
	await updateMediaMeta(target.id, meta);

	// 2. Tracking
	const seasons: (SeasonTracking & { mediaId: string })[] = [];
	for (const m of members) {
		const tracking = await getTracking(m.id);
		if (!tracking) continue;
		if (seriesIds.has(m.id)) {
			seasons.push({ ...seriesTrackingAsSeason(chain, tracking), mediaId: m.id });
			continue;
		}
		const seasonIndex = chain.findIndex((n) => String(n.id) === m.externalId);
		if (seasonIndex >= 0) seasons.push({ seasonIndex, tracking, mediaId: m.id });
	}
	if (seasons.length > 0) {
		const merged = mergeSeasonTracking(chain, seasons);
		const keep = seasons.find((s) => s.mediaId === target.id) ?? seasons[0];
		await writeTracking(target.id, merged, keep.tracking.id);
		for (const s of seasons) {
			if (s !== keep) await db.run('DELETE FROM TrackingStatus WHERE id = ?', [s.tracking.id]);
		}
	}

	// 3. History, collections and feed follow the series
	for (const m of others) {
		for (const table of ['WatchCycle', 'CollectionItem', 'ActivityLog']) {
			await db.run(`UPDATE ${table} SET mediaId = ? WHERE mediaId = ?`, [target.id, m.id]);
		}
	}
	await db.run(
		`DELETE FROM CollectionItem WHERE mediaId = ? AND rowid NOT IN
			(SELECT MIN(rowid) FROM CollectionItem WHERE mediaId = ? GROUP BY collectionId)`,
		[target.id, target.id],
	);
	const cycles = await db.query(
		'SELECT id FROM WatchCycle WHERE mediaId = ? ORDER BY startedAt ASC',
		[target.id],
	);
	for (const [i, row] of (cycles.values ?? []).entries()) {
		const id = Array.isArray(row) ? row[0] : (row as { id: string }).id;
		await db.run('UPDATE WatchCycle SET cycleNumber = ? WHERE id = ?', [i + 1, id]);
	}

	// 4. Season items go last, once nothing points at them
	for (const m of others) await db.run('DELETE FROM Media WHERE id = ?', [m.id]);
	await addAnimeSeriesIds([target.id]);
	seriesIds.add(target.id);
	return true;
}

let running: Promise<{ merged: number; pending: number }> | null = null;

/**
 * Merge every AniList anime season in the library into its series. Safe to re-run:
 * already-merged series are left alone unless new season items joined them. Returns how
 * many series were merged and how many were skipped (retried on the next run).
 */
export function mergeAnimeSeasonsInLibrary(
	onProgress?: (done: number, total: number) => void,
): Promise<{ merged: number; pending: number }> {
	// One run at a time (settings, startup retry and imports can all trigger one)
	running ??= runMerge(onProgress).finally(() => (running = null));
	return running;
}

async function runMerge(
	onProgress?: (done: number, total: number) => void,
): Promise<{ merged: number; pending: number }> {
	// The merged-series marker lives in AppSettings, which backups don't cover — keep it with them
	const backup = { db: await exportDatabaseJson(), seriesIds: [...(await getAnimeSeriesIds())] };
	await setAppSetting(BACKUP_KEY, JSON.stringify(backup));

	const result = await getDb().query(
		"SELECT * FROM Media WHERE source = 'anilist' AND type = 'anime'",
	);
	const library = (result.values ?? []).map(rowToMedia);
	const byExternalId = new Map(library.map((m) => [m.externalId, m]));
	const seriesIds = await getAnimeSeriesIds();
	const handled = new Set<string>();
	let merged = 0;
	let pending = 0;

	for (const [i, media] of library.entries()) {
		onProgress?.(i, library.length);
		if (handled.has(media.externalId)) continue;
		handled.add(media.externalId);

		const started = Date.now();
		try {
			const chain = await resolveAnilistSeriesChain(parseInt(media.externalId));
			if (!chain) continue;
			for (const node of chain) handled.add(String(node.id));
			const members = chain
				.map((n) => byExternalId.get(String(n.id)))
				.filter((m): m is LocalMedia => !!m);
			// A lone, already-merged series has nothing to fold in
			if (members.length === 1 && seriesIds.has(members[0].id)) continue;
			if (await mergeSeries(chain, members, seriesIds)) merged++;
			else pending++;
		} catch (err) {
			console.error('[anime merge] skipped', media.title, err);
			pending++;
		}
		// Stay under AniList's rate limit when the chain came from the network
		if (Date.now() - started > 200) await new Promise((r) => setTimeout(r, 1500));
	}

	onProgress?.(library.length, library.length);
	await setAppSettingBool(PENDING_KEY, pending > 0);
	return { merged, pending };
}

/** True when a previous merge skipped series that should be retried. */
export function isAnimeMergePending(): Promise<boolean> {
	return getAppSettingBool(PENDING_KEY, false);
}

export async function hasAnimeMergeBackup(): Promise<boolean> {
	return (await getAppSetting(BACKUP_KEY)) !== null;
}

/**
 * Restore the library as it was before the last merge run and switch merging off.
 * Changes made since that run are lost.
 */
export async function restoreAnimeMergeBackup(): Promise<void> {
	const raw = await getAppSetting(BACKUP_KEY);
	if (!raw) throw new Error('No pre-merge backup found');
	const backup: { db: string; seriesIds: string[] } = JSON.parse(raw);
	await importDatabaseJson(backup.db);
	await clearAnimeSeriesIds();
	await addAnimeSeriesIds(backup.seriesIds);
	await setMergeAnimeSeasonsEnabled(false);
	await setAppSettingBool(PENDING_KEY, false);
	await getDb().run('DELETE FROM AppSettings WHERE key = ?', [BACKUP_KEY]);
}
