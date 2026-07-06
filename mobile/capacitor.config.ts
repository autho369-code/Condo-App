import type { CapacitorConfig } from '@capacitor/cli'

// Portier369 mobile shell.
//
// The app loads the production site directly (server.url), so every deploy
// to portier369.com updates the app instantly — no store re-submission
// needed for web changes. Only native-layer changes (plugins, icons,
// splash, config) require a new store build.
const config: CapacitorConfig = {
  appId: 'com.portier369.app',
  appName: 'Portier369',
  webDir: 'www',
  server: {
    url: 'https://portier369.com',
    // Keep every *.portier369.com tenant subdomain inside the app's webview
    // (tenant-branded login lives on subdomains). Anything else — Stripe
    // onboarding, Plaid, mailto — opens in the system browser, which is
    // what Apple/Google review expects for third-party flows.
    allowNavigation: ['portier369.com', '*.portier369.com'],
  },
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#ffffff',
  },
  android: {
    backgroundColor: '#ffffff',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: '#060709',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DEFAULT',
      backgroundColor: '#ffffff',
    },
  },
}

export default config
