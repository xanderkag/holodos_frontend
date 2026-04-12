import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.holodos.ai',
  appName: 'HOLODOS AI',
  webDir: 'dist',
  plugins: {
    GoogleSignIn: {
      clientId: '983609791949-041og7lpedat9olfnp3iptgpi7q18rqv.apps.googleusercontent.com',
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
