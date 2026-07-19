module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  testPathIgnorePatterns: ['/node_modules/'],
  collectCoverageFrom: ['core/**/*.{ts,tsx}', '!core/**/*.test.{ts,tsx}'],
};
