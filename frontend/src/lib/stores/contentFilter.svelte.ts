import type { AdultFilterMode, ContentFilterPrefs } from '$lib/db/services/settings.service';
import type { ContentFilterMode } from '$lib/utils/contentFilter';

class ContentFilterState {
	enabled = $state(true);
	mode = $state<AdultFilterMode>('hide');
	/** Whether the first-launch prompt has been answered. */
	asked = $state(true);

	/** What the UI does with adult content right now: 'show' when the filter is off. */
	get effectiveMode(): ContentFilterMode {
		return this.enabled ? this.mode : 'show';
	}

	setPrefs = (prefs: ContentFilterPrefs) => {
		this.enabled = prefs.enabled;
		this.mode = prefs.mode;
		this.asked = prefs.asked;
	};

	setEnabled = (enabled: boolean) => {
		this.enabled = enabled;
		this.asked = true;
	};

	setMode = (mode: AdultFilterMode) => {
		this.mode = mode;
	};
}

export const contentFilterStore = new ContentFilterState();
