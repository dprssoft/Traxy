import { exportDatabaseJson } from '$lib/db/services/backup.service';

const AUTOSAVE_KEY = 'traxy:autosave';

export interface AutosaveRecord {
	json: string;
	ts: string;
}

export function saveAutosave(json: string): void {
	try {
		localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ json, ts: new Date().toISOString() }));
	} catch {
		// localStorage full or unavailable — silently skip
	}
}

export function getAutosave(): AutosaveRecord | null {
	try {
		const raw = localStorage.getItem(AUTOSAVE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as AutosaveRecord;
		return parsed.json && parsed.ts ? parsed : null;
	} catch {
		return null;
	}
}

export function clearAutosave(): void {
	localStorage.removeItem(AUTOSAVE_KEY);
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

export function triggerAutosave(): void {
	if (debounceTimer) clearTimeout(debounceTimer);
	debounceTimer = setTimeout(async () => {
		try {
			const json = await exportDatabaseJson();
			saveAutosave(json);
		} catch {
			// Never throw — autosave is best-effort
		}
	}, 30_000);
}
