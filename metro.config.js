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

const { enhanceMiddleware } = config.server || {};
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware, server) => {
    const base = enhanceMiddleware ? enhanceMiddleware(middleware, server) : middleware;
    return (req, res, next) => {
      res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
      return base(req, res, next);
    };
  },
};

module.exports = config;
