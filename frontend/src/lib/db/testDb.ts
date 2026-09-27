/**
 * Test-only helper: an in-memory SQLite database (sql.js, asm build — no WASM file needed)
 * exposing the subset of SQLiteDBConnection the services use, with the real schema applied.
 * Rows come back as objects, matching @capacitor-community/sqlite.
 */
// @ts-expect-error sql.js ships no type declarations
import initSqlJs from 'sql.js/dist/sql-asm.js';
import type { SQLiteDBConnection } from '@capacitor-community/sqlite';
import { applySchema } from './index';

type SqlValue = string | number | null;

export async function createTestDb(): Promise<SQLiteDBConnection> {
	const SQL = await initSqlJs();
	const raw = new SQL.Database();

	const conn = {
		async execute(sql: string) {
			raw.exec(sql);
			return { changes: { changes: raw.getRowsModified() } };
		},
		async query(sql: string, values: SqlValue[] = []) {
			const stmt = raw.prepare(sql);
			stmt.bind(values);
			const rows: Record<string, unknown>[] = [];
			while (stmt.step()) rows.push(stmt.getAsObject());
			stmt.free();
			return { values: rows };
		},
		async run(sql: string, values: SqlValue[] = []) {
			raw.run(sql, values);
			return { changes: { changes: raw.getRowsModified() } };
		},
	} as unknown as SQLiteDBConnection;

	await applySchema(conn);
	return conn;
}
