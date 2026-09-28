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
