class AnimeSeasonsState {
	/** Mirrors the `feat_merge_anime_seasons` flag: one media item per anime series. */
	mergeEnabled = $state(false);

	setMergeEnabled = (enabled: boolean) => {
		this.mergeEnabled = enabled;
	};
}

export const animeSeasonsStore = new AnimeSeasonsState();
