import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
	appId: 'vc.dprssoft.traxy',
	appName: 'Traxy',
	webDir: 'build',
	plugins: {
		CapacitorHttp: { enabled: true },
		CapacitorSQLite: { androidIsEncryption: false },
	},
};

export default config;
