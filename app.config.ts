import type { ExpoConfig } from 'expo/config';

/**
 * Bundle ids: com.laundroswipe.app (iOS + Android).
 * Scheme: laundroswipe:// (OAuth callback, deep links).
 * Associated domain: laundroswipe.com (universal links).
 */
const config = (): ExpoConfig => ({
  name: 'LaundroSwipe',
  slug: 'laundroswipe',
  scheme: 'laundroswipe',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  splash: {
    image: './assets/images/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#1746A2',
  },
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.laundroswipe.app',
    associatedDomains: ['applinks:laundroswipe.com'],
    infoPlist: {
      NSCameraUsageDescription: 'LaundroSwipe uses the camera to scan order tokens at pickup.',
      NSBluetoothAlwaysUsageDescription:
        'LaundroSwipe connects to Bluetooth thermal printers to print receipts.',
      NSBluetoothPeripheralUsageDescription:
        'LaundroSwipe connects to Bluetooth thermal printers to print receipts.',
      UIBackgroundModes: ['bluetooth-central'],
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: 'com.laundroswipe.app',
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
    adaptiveIcon: {
      foregroundImage: './assets/images/adaptive-icon.png',
      backgroundColor: '#1746A2',
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    permissions: [
      'CAMERA',
      'VIBRATE',
      'BLUETOOTH',
      'BLUETOOTH_ADMIN',
      'BLUETOOTH_CONNECT',
      'BLUETOOTH_SCAN',
    ],
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [{ scheme: 'https', host: 'laundroswipe.com' }],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
  },
  web: {
    bundler: 'metro',
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-font',
    'expo-web-browser',
    'expo-secure-store',
    [
      'expo-camera',
      {
        cameraPermission: 'LaundroSwipe uses the camera to scan order tokens at pickup.',
      },
    ],
    'expo-notifications',
    [
      'react-native-ble-plx',
      {
        isBackgroundEnabled: true,
        modes: ['peripheral', 'central'],
        bluetoothAlwaysPermission:
          'LaundroSwipe connects to Bluetooth thermal printers to print receipts.',
      },
    ],
  ],
  experiments: { typedRoutes: true },
  extra: {
    eas: {
      projectId: '1dacd981-be63-4ce3-a46f-4de81e1ee499',
    },
  },
  owner: 'itsrahulbk',
  updates: {
    url: 'https://u.expo.dev/1dacd981-be63-4ce3-a46f-4de81e1ee499',
  },
  runtimeVersion: {
    policy: 'appVersion',
  },
});

export default config;
