import type { UserProfile } from '$lib/db/services/settings.service';

export type UserState = UserProfile;

let user = $state<UserState | null>(null);

/**
 * Local profile shown in the sidebar and profile page. The root layout loads it; the profile
 * page saves it through the settings service.
 */
export const userStore = {
	get value() {
		return user;
	},
	set(newUser: UserState | null) {
		user = newUser;
	},
	init(data: UserState | null) {
		user = data;
	},
};
