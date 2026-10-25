module.exports = {
  preset: 'jest-expo',
  // Explicit testRegex overrides the empty array jest-expo sets, which breaks
  // test discovery when running jest from inside a worktree directory.
  testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.[jt]sx?$',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|native-base|react-native-svg)',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/supabase/',
    // Anchored to <rootDir> so this only excludes worktrees NESTED under the
    // directory jest is run from (the intended case: running from the repo
    // root shouldn't double-run tests inside .worktrees/*). An unanchored
    // '/.worktrees/' also matches jest's own rootDir when run from INSIDE a
    // worktree (e.g. .worktrees/<name>), since that path is a substring of
    // every test file's absolute path — which excludes every test and
    // reports "no tests found".
    '<rootDir>/\\.worktrees/',
  ],
  moduleNameMapper: {
    '^@react-native-async-storage/async-storage$':
      require.resolve('@react-native-async-storage/async-storage/jest/async-storage-mock'),
  },
  testTimeout: 15000,
  setupFilesAfterEnv: ['@testing-library/react-native/extend-expect'],

}
