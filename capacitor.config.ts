import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.openpolis.game',
  appName: 'Openpolis',
  webDir: 'dist-native',
  server: { hostname: 'localhost', androidScheme: 'https' },
  android: { backgroundColor: '#132a30', allowMixedContent: false },
  plugins: { SystemBars: { insetsHandling: 'native', initialViewportFitValueHint: 'cover' } },
};
export default config;
