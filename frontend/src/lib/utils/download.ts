import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';

/**
 * Save text content as a file. On Android it is written to the public Download folder (the
 * WebView ignores `<a download>` links); on the web it goes through a temporary object-URL link.
 */
export async function downloadFile(
	filename: string,
	content: string,
	mimeType: string,
): Promise<void> {
	if (Capacitor.isNativePlatform()) {
		// Only Android 10 and older need the storage permission; newer versions report it granted.
		const { publicStorage } = await Filesystem.requestPermissions();
		if (publicStorage !== 'granted') throw new Error('Storage permission denied');
		await Filesystem.writeFile({
			path: `Download/${filename}`,
			data: content,
			directory: Directory.ExternalStorage,
			encoding: Encoding.UTF8,
			recursive: true,
		});
		return;
	}

	const blob = new Blob([content], { type: mimeType });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}

/**
 * Share text content as a file through the system share sheet. On Android it is written to the
 * app cache first (exposed through the FileProvider) and shared by URI; on the web it uses the
 * Web Share API. Returns false when file sharing isn't available (the caller can download instead).
 */
export async function shareFile(
	filename: string,
	content: string,
	mimeType: string,
	title: string,
): Promise<boolean> {
	if (Capacitor.isNativePlatform()) {
		const { Share } = await import('@capacitor/share');
		const { uri } = await Filesystem.writeFile({
			path: filename,
			data: content,
			directory: Directory.Cache,
			encoding: Encoding.UTF8,
		});
		await Share.share({ title, dialogTitle: title, files: [uri] });
		return true;
	}

	const file = new File([content], filename, { type: mimeType });
	if (!navigator.canShare?.({ files: [file] })) return false;
	await navigator.share({ files: [file], title });
	return true;
}

/** True when the user closed the share sheet without sharing (not an error worth reporting). */
export function isShareCancelled(err: unknown): boolean {
	return err instanceof Error && (err.name === 'AbortError' || /cancel/i.test(err.message));
}
