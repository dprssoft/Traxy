import { getDb } from '../index';

export async function exportDatabaseJson(): Promise<string> {
	const db = getDb();
	const tables = ['LocalMedia', 'TrackingStatus', 'WatchCycle', 'ActivityLog', 'CustomCollection', 'CollectionItem'];
	
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
		
		const tables = ['ActivityLog', 'WatchCycle', 'TrackingStatus', 'CollectionItem', 'CustomCollection', 'LocalMedia'];
		
		for (const table of tables) {
			await db.run(`DELETE FROM ${table}`);
			
			const rows = data[table] || [];
			if (rows.length === 0) continue;

			// Insert rows dynamically. This assumes rows are arrays of values in the correct column order.
			// The export gives arrays of arrays for values.
			for (const row of rows) {
				const placeholders = row.map(() => '?').join(', ');
				await db.run(`INSERT INTO ${table} VALUES (${placeholders})`, row);
			}
		}

	} catch (err) {
		console.error('Import failed', err);
		throw err;
	}
}
