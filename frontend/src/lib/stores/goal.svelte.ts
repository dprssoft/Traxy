interface YearlyGoal {
	year: number;
	watchCount: number; // films, tv, anime
	gameCount: number; // games
	readCount: number; // books, manga, comics
}

const currentYear = () => new Date().getFullYear();

const DEFAULT_GOALS: YearlyGoal = {
	year: currentYear(),
	watchCount: 50,
	gameCount: 12,
	readCount: 20,
};

function loadGoals(): YearlyGoal {
	const year = currentYear();
	const stored = localStorage.getItem(`traxy:goals:${year}`);
	if (stored) {
		try {
			return { ...DEFAULT_GOALS, ...JSON.parse(stored), year };
		} catch {
			return DEFAULT_GOALS;
		}
	}
	return DEFAULT_GOALS;
}

/** This year's reading/watching/playing targets, kept per year in localStorage. */
export const goalStore = $state<{ current: YearlyGoal }>({
	current: DEFAULT_GOALS,
});

if (typeof window !== 'undefined') {
	goalStore.current = loadGoals();
}

/** Merge `goals` into this year's targets and persist them. */
export function saveGoals(goals: Partial<YearlyGoal>) {
	const year = currentYear();
	goalStore.current = { ...goalStore.current, ...goals, year };
	localStorage.setItem(`traxy:goals:${year}`, JSON.stringify(goalStore.current));
}
