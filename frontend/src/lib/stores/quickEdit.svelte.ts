import type { LocalMedia } from '$lib/types/mediaTypes';
import type { LocalTrackingStatus } from '$lib/types/trackingTypes';

export interface QuickEditCallbacks {
	/** Tracking was created, changed or removed (null) from the sheet. */
	onTrackingChanged?: (t: LocalTrackingStatus | null) => void;
	/** The sheet closed — reload anything it may have changed (collections, notes…). */
	onClosed?: () => void;
}

/** Which media the app-wide quick-edit sheet is showing, if any. */
class QuickEditState {
	media = $state<LocalMedia | null>(null);
	callbacks: QuickEditCallbacks = {};

	open = (media: LocalMedia, callbacks: QuickEditCallbacks = {}) => {
		this.callbacks = callbacks;
		this.media = media;
	};

	close = () => {
		const { onClosed } = this.callbacks;
		this.media = null;
		this.callbacks = {};
		onClosed?.();
	};
}

export const quickEdit = new QuickEditState();
