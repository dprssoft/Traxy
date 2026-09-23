import { getDb } from '../index';

export async function exportDatabaseJson(): Promise<string> {
	const db = getDb();
	const tables = ['Media', 'TrackingStatus', 'WatchCycle', 'ActivityLog', 'Collection', 'CollectionItem', 'Goal'];
	
	const exportData: Record<string, any[]> = {};

	for (const table of tables) {
		const res = await db.query(`SELECT * FROM ${table}`);
		exportData[table] = res.values || [];
	}

	return JSON.stringify({
		version: 1,
		timestamp: new Date().toISOString(),
		data: exportData
	}, null, 2);
}

export async function importDatabaseJson(jsonString: string): Promise<void> {
	try {
		const parsed = JSON.parse(jsonString);
		if (!parsed.data) throw new Error('Invalid backup format');
		
		const db = getDb();
		const data = parsed.data;

		// Clear existing data (in a real app we might want to drop and recreate, but we'll just DELETE FROM)
		// SQLite foreign keys might complain, so we delete in reverse dependency order or just disable foreign keys
		// Note: capacitor-sqlite disables PRAGMA foreign_keys by default unless explicitly turned on.
		
		const tables = ['Goal', 'ActivityLog', 'WatchCycle', 'TrackingStatus', 'CollectionItem', 'Collection', 'Media'];
		
		for (const table of tables) {
			await db.run(`DELETE FROM ${table}`);
			
			const rows = data[table] || [];
			if (rows.length === 0) continue;

			// Insert rows dynamically. This assumes rows are arrays of values in the correct column order.
			// The export gives arrays of arrays for values. Backups made before a column was added have
			// shorter rows — pad them with NULLs so the positional INSERT still matches the table.
			const columnCount = (await db.query(`PRAGMA table_info(${table})`)).values?.length ?? 0;
			for (const row of rows) {
				while (row.length < columnCount) row.push(null);
				const placeholders = row.map(() => '?').join(', ');
				await db.run(`INSERT INTO ${table} VALUES (${placeholders})`, row);
			}
		}

	} catch (err) {
		console.error('Import failed', err);
		throw err;
	}
}

export async function clearMediaCache(): Promise<void> {
	const db = getDb();
	await db.run('DELETE FROM ApiCache');
}

export async function resetAllUserData(): Promise<void> {
	const db = getDb();
	const tables = ['ActivityLog', 'WatchCycle', 'TrackingStatus', 'CollectionItem', 'Collection', 'Media', 'ApiCache', 'AppSettings', 'Goal'];
	for (const table of tables) {
		await db.run(`DELETE FROM ${table}`);
	}
}
