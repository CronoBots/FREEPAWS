import type { ConfigContext, ExpoConfig } from "expo/config";

// Identifiants définitifs côté stores : ne plus les changer après la première publication.
const BUNDLE_ID = "be.freepaws.app";
const CREAM = "#faf1e7";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "FreePaws",
  slug: "freepaws",
  owner: process.env.EAS_OWNER,
  scheme: "freepaws",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  backgroundColor: CREAM,
  ios: {
    bundleIdentifier: BUNDLE_ID,
    supportsTablet: false,
    config: { usesNonExemptEncryption: false },
  },
  android: {
    package: BUNDLE_ID,
    adaptiveIcon: {
      backgroundColor: CREAM,
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundImage: "./assets/android-icon-background.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    favicon: "./assets/favicon.png",
    output: "single",
  },
  plugins: [
    "expo-router",
    [
      "expo-splash-screen",
      {
        image: "./assets/splash-icon.png",
        imageWidth: 200,
        backgroundColor: CREAM,
      },
    ],
    "expo-font",
    "expo-secure-store",
    "expo-video",
    "expo-image",
    "expo-notifications",
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    eas: process.env.EAS_PROJECT_ID ? { projectId: process.env.EAS_PROJECT_ID } : undefined,
  },
});
