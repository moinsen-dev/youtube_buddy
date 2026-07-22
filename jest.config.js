module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  testPathIgnorePatterns: ['/node_modules/'],
  // @noble/hashes ships ESM only — transform it (core/sync crypto, phase 11).
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|@noble/hashes))',
  ],
  collectCoverageFrom: ['core/**/*.{ts,tsx}', '!core/**/*.test.{ts,tsx}'],
};
