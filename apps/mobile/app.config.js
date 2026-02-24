const fs = require('node:fs');
const path = require('node:path');

const pkg = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8')
);

const APP_NAME = 'NewsDrip';
const APP_SLUG = 'newsdrip-mobile';
const APP_SCHEME = 'newsdrip';
const APP_VERSION = pkg.version || '1.0.0';

const IOS_BUNDLE_ID =
  process.env.EXPO_PUBLIC_IOS_BUNDLE_ID || 'com.krisalexander.newsdrip';
const ANDROID_PACKAGE =
  process.env.EXPO_PUBLIC_ANDROID_PACKAGE || 'com.krisalexander.newsdrip';

module.exports = {
  expo: {
    name: APP_NAME,
    slug: APP_SLUG,
    version: APP_VERSION,
    scheme: APP_SCHEME,
    orientation: 'portrait',
    userInterfaceStyle: 'light',
    icon: './assets/icon.png',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#f4f1ea'
    },
    assetBundlePatterns: ['**/*'],
    ios: {
      icon: './assets/icon-ios.png',
      supportsTablet: true,
      bundleIdentifier: IOS_BUNDLE_ID,
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false
      }
    },
    android: {
      package: ANDROID_PACKAGE,
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#f4f1ea'
      }
    },
    web: {
      bundler: 'metro',
      favicon: './assets/favicon.png'
    },
    extra: {
      apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL || '',
      eas: {
        projectId:
          process.env.EXPO_PUBLIC_EAS_PROJECT_ID ||
          process.env.EAS_PROJECT_ID ||
          '731fa584-4177-4835-ba3a-4a289ca0510e'
      }
    },
    runtimeVersion: {
      policy: 'appVersion'
    },
    updates: {
      url:
        process.env.EXPO_PUBLIC_UPDATES_URL ||
        process.env.EAS_UPDATES_URL ||
        'https://u.expo.dev/731fa584-4177-4835-ba3a-4a289ca0510e',
      fallbackToCacheTimeout: 0
    }
  }
};
