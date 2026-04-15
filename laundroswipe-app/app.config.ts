import type { ExpoConfig } from 'expo/config';

const defineConfig = (): ExpoConfig => ({
  name: 'laundroswipe-app',
  slug: 'laundroswipe-app',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'laundroswipeapp',
  userInterfaceStyle: 'automatic',
  // Reanimated 4.x (Expo SDK 54) requires the New Architecture — see react-native-reanimated assertNewArchitectureEnabledTask.
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.laundroswipe.unified',
  },
  android: {
    package: 'com.laundroswipe.unified',
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    permissions: [
      'android.permission.BLUETOOTH',
      'android.permission.BLUETOOTH_ADMIN',
      'android.permission.BLUETOOTH_CONNECT',
      'android.permission.BLUETOOTH_SCAN',
      'android.permission.ACCESS_FINE_LOCATION',
    ],
  },
  web: {
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        image: './assets/images/splash-icon.png',
        imageWidth: 200,
        resizeMode: 'contain',
        backgroundColor: '#ffffff',
        dark: { backgroundColor: '#000000' },
      },
    ],
  ],
  experiments: {
    typedRoutes: false,
    reactCompiler: true,
  },
  // Required for EAS with app.config.ts (dynamic config cannot be auto-linked). expo.dev → Project settings → Project ID
  extra: {
    eas: {
      projectId: '5643cac1-19ac-430d-8b50-cfc3aeae6db3',
    },
  },
});

export default defineConfig;
