/**
 * A place the sync document lives: Google Drive today, WebDAV/Dropbox/… later. A provider only
 * stores and fetches one opaque file; merging is the sync engine's job.
 */
export interface RemoteFile {
	content: string;
	/** Changes whenever the file is written; passed back to `write` to detect a race. */
	revision: string;
}

export interface SyncProvider {
	readonly id: string;
	readonly label: string;
	/** Has credentials that should work without asking the user. */
	isConnected(): boolean;
	/** Ask the user to sign in / grant access. */
	connect(): Promise<void>;
	disconnect(): Promise<void>;
	/** The current file, or null if nothing has been synced yet. */
	read(): Promise<RemoteFile | null>;
	/**
	 * Replace the file. `baseRevision` is the revision the content was merged from (null when there
	 * was no file); throw `SyncConflictError` if the file changed since. Returns the new revision.
	 */
	write(content: string, baseRevision: string | null): Promise<string>;
}

/** Another device wrote the file between our read and write; the engine re-reads and retries. */
export class SyncConflictError extends Error {
	constructor() {
		super('The sync file changed during sync');
		this.name = 'SyncConflictError';
	}
}

/**
 * The drive needs the user to sign in again (never connected, access revoked, or — on the web —
 * the short-lived token expired and renewing it needs a click). Auto-sync waits for the user.
 */
export class SyncAuthError extends Error {
	constructor(message = 'Sign in to your drive again to keep syncing') {
		super(message);
		this.name = 'SyncAuthError';
	}
}

/** An in-memory provider: a stand-in drive for tests, shared by several simulated devices. */
export class MemoryProvider implements SyncProvider {
	readonly id = 'memory';
	readonly label = 'Memory';
	file: RemoteFile | null = null;
	private counter = 0;

	isConnected() {
		return true;
	}
	async connect() {}
	async disconnect() {}
	async read() {
		return this.file ? { ...this.file } : null;
	}
	async write(content: string, baseRevision: string | null) {
		if ((this.file?.revision ?? null) !== baseRevision) throw new SyncConflictError();
		this.file = { content, revision: String(++this.counter) };
		return this.file.revision;
	}
}
