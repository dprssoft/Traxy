import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.yourname.tracklist',
  appName: 'Track List',
  webDir: 'build',
  plugins: {
    CapacitorHttp: { enabled: true },
    CapacitorSQLite: { androidIsEncryption: false }
  }
};

export default config;
