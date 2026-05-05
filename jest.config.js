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
  ],
  moduleNameMapper: {
    '^@react-native-async-storage/async-storage$':
      require.resolve('@react-native-async-storage/async-storage/jest/async-storage-mock'),
  },
  testTimeout: 15000,
}
