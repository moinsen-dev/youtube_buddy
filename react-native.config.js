/**
 * Autolinking overrides for tvOS (phase 12 / TV-Konsolidierung).
 *
 * - @react-native-google-signin: TV is a consumption view without sign-in.
 *   Without this override ReactCodegen still registers RNGoogleSignInButton
 *   as a Fabric component — NSClassFromString then returns nil at runtime and
 *   the app aborts in RCTThirdPartyComponentsProvider (nil insertion).
 * - react-native-webview: WKWebView does not exist on tvOS. Playback is out
 *   of scope on TV (PRD §7.3), so features/player/youtube-player.tvos.tsx is
 *   a stub and nothing imports the module there.
 *
 * Platform-scoped by construction: only the `tvos` key is nulled, so iOS and
 * Android link both modules exactly as before. This is what lets phone and TV
 * share one checkout instead of a second worktree.
 */
module.exports = {
  dependencies: {
    '@react-native-google-signin/google-signin': {
      platforms: { tvos: null },
    },
    'react-native-webview': {
      platforms: { tvos: null },
    },
  },
};
