const { getDefaultConfig } = require('expo/metro-config');

/**
 * Metro config (phase 11, expo-sqlite on web):
 * - `wasm` asset extension for the wa-sqlite bundle
 * - COOP/COEP headers so SharedArrayBuffer is allowed (expo-sqlite's sync
 *   API on web needs cross-origin isolation; dev server only — production
 *   hosting must send the same headers, see docs/ROADMAP.md phase 11).
 */
const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push('wasm');

// Phase 12 (Apple TV): when bundling with EXPO_TV=1, resolve `.tvos.*`
// platform files before the base files (e.g. youtube-player.tvos.tsx stubs
// out the WebView player, which is not linked on tvOS). react-native-tvos
// documents this exact pattern for Expo; plain builds are unaffected.
if (process.env.EXPO_TV === '1') {
  const sourceExts = config.resolver.sourceExts;
  config.resolver.sourceExts = [...sourceExts.map((ext) => `tvos.${ext}`), ...sourceExts];
}

const { enhanceMiddleware } = config.server || {};
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware, server) => {
    const base = enhanceMiddleware ? enhanceMiddleware(middleware, server) : middleware;
    return (req, res, next) => {
      res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
      // same-origin-allow-popups: crossOriginIsolated stays true (SAB for
      // expo-sqlite) AND OAuth popups keep their opener — plain
      // 'same-origin' severed the Google sign-in popup from the app
      // (token never came back; verified with the user, phase 11).
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
      return base(req, res, next);
    };
  },
};

module.exports = config;
