import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
	appId: 'vc.dprssoft.traxy',
	appName: 'Traxy',
	webDir: 'build',
	plugins: {
		CapacitorHttp: { enabled: true },
		CapacitorSQLite: { androidIsEncryption: false },
		// Only Google is used (Drive sync); keep the other providers' SDKs out of the app.
		SocialLogin: { providers: { google: true, facebook: false, apple: false, twitter: false } },
	},
};

export default config;
