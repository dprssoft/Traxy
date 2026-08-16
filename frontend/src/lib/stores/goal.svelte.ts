interface YearlyGoal {
	year: number;
	watchCount: number; // films, tv, anime
	gameCount: number; // games
	readCount: number; // books, manga, comics
}

const DEFAULT_GOALS: YearlyGoal = {
	year: new Date().getFullYear(),
	watchCount: 50,
	gameCount: 12,
	readCount: 20,
};

function loadGoals(): YearlyGoal {
	const year = new Date().getFullYear();
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

export const goalStore = $state<{ current: YearlyGoal }>({
	current: DEFAULT_GOALS,
});

if (typeof window !== 'undefined') {
	goalStore.current = loadGoals();
}

export function saveGoals(goals: Partial<YearlyGoal>) {
	const year = new Date().getFullYear();
	goalStore.current = { ...goalStore.current, ...goals, year };
	localStorage.setItem(`traxy:goals:${year}`, JSON.stringify(goalStore.current));
}
