import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.holodos.ai',
  appName: 'HOLODOS AI',
  webDir: 'dist',
  plugins: {
    // Native Google Sign-In plugin (@codetrix-studio/capacitor-google-auth)
    // serverClientId = Web Client ID (used to exchange native token with Firebase)
    // Android OAuth Client ID must be registered separately in Google Cloud Console
    // with package: com.holodos.ai and SHA-1: 93:12:3B:04:41:F5:57:D4:9E:74:40:44:33:3D:CC:5A:6D:7F:FF:AF
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: '983609791949-041og7lpedat9olfnp3iptgpi7q18rqv.apps.googleusercontent.com',
      forceCodeForRefreshToken: true,
    },
  },
  /*
  server: {
    url: 'https://app.holodos.su',
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#121212",
      showSpinner: false,
      androidScaleType: "CENTER_CROP",
      iosScaleType: "centerAspectFill",
      splashFullScreen: false,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: "#121212",
    },
  }
  */
};

export default config;
