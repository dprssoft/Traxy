export interface NavItem {
	href: string;
	label: string;
	icon: string;
	badge?: string;
	match: (pathname: string) => boolean;
}

export const defaultBottomNavItems: NavItem[] = [
	{
		href: '/',
		label: 'Feed',
		icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
		match: (p) => p === '/'
	},
	{
		href: '/catalogue',
		label: 'Catalogue',
		icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z',
		match: (p) => p.startsWith('/catalogue') || p.startsWith('/search')
	},
	{
		href: '/tracking',
		label: 'Tracking',
		icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10',
		match: (p) => p.startsWith('/tracking')
	},
	{
		href: '/collections',
		label: 'Lists',
		icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10',
		match: (p) => p.startsWith('/collections')
	},
	{
		href: '/stats',
		label: 'Statistics',
		icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
		match: (p) => p.startsWith('/stats')
	}
];

export const drawerNavItems: NavItem[] = [
	{
		href: '/',
		label: 'Feed',
		icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
		match: (p) => p === '/'
	},
	{
		href: '/catalogue',
		label: 'Catalogue',
		icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z',
		match: (p) => p.startsWith('/catalogue') || p.startsWith('/search')
	},
	{
		href: '/tracking',
		label: 'Tracking',
		icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10',
		match: (p) => p.startsWith('/tracking')
	},
	{
		href: '/collections',
		label: 'Lists',
		icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10',
		match: (p) => p.startsWith('/collections')
	},
	{
		href: '/stats',
		label: 'Statistics',
		icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
		match: (p) => p.startsWith('/stats')
	},
	{
		href: '/achievements',
		label: 'Achievements',
		icon: 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z',
		badge: 'New',
		match: (p) => p.startsWith('/achievements')
	},
	{
		href: '/settings',
		label: 'Settings',
		icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
		match: (p) => p.startsWith('/settings') && !p.startsWith('/settings/about')
	},
	{
		href: '/settings/about',
		label: 'About',
		icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
		match: (p) => p.startsWith('/settings/about')
	}
];

class LayoutState {
	topbarMirrored = $state(false);
	sidebarCollapsed = $state(false);
	mobileMenuOpen = $state(false);
	bottomNavItems = $state<NavItem[]>(defaultBottomNavItems);

	constructor() {
		if (typeof window !== 'undefined') {
			try {
				const savedMirror = localStorage.getItem('traxy_topbar_mirrored');
				if (savedMirror !== null) {
					this.topbarMirrored = savedMirror === 'true';
				}
				const savedCollapsed = localStorage.getItem('traxy_sidebar_collapsed');
				if (savedCollapsed !== null) {
					this.sidebarCollapsed = savedCollapsed === 'true';
				}
			} catch (e) {
				console.error('Failed to read layout preferences', e);
			}
		}
	}

	toggleTopbarMirror = () => {
		this.topbarMirrored = !this.topbarMirrored;
		if (typeof window !== 'undefined') {
			try {
				localStorage.setItem('traxy_topbar_mirrored', String(this.topbarMirrored));
			} catch (e) {
				console.error('Failed to persist topbar mirror preference', e);
			}
		}
	};

	setTopbarMirror = (mirrored: boolean) => {
		this.topbarMirrored = mirrored;
		if (typeof window !== 'undefined') {
			try {
				localStorage.setItem('traxy_topbar_mirrored', String(this.topbarMirrored));
			} catch (e) {
				console.error('Failed to persist topbar mirror preference', e);
			}
		}
	};

	toggleSidebar = () => {
		this.sidebarCollapsed = !this.sidebarCollapsed;
		if (typeof window !== 'undefined') {
			try {
				localStorage.setItem('traxy_sidebar_collapsed', String(this.sidebarCollapsed));
			} catch (e) {
				console.error('Failed to persist sidebar collapsed preference', e);
			}
		}
	};

	setSidebarCollapsed = (collapsed: boolean) => {
		this.sidebarCollapsed = collapsed;
		if (typeof window !== 'undefined') {
			try {
				localStorage.setItem('traxy_sidebar_collapsed', String(this.sidebarCollapsed));
			} catch (e) {
				console.error('Failed to persist sidebar collapsed preference', e);
			}
		}
	};

	openMobileMenu = () => {
		this.mobileMenuOpen = true;
	};

	closeMobileMenu = () => {
		this.mobileMenuOpen = false;
	};

	toggleMobileMenu = () => {
		this.mobileMenuOpen = !this.mobileMenuOpen;
	};
}

export const layoutStore = new LayoutState();
export const navItems = defaultBottomNavItems;
