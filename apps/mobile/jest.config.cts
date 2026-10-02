const path = require('path');

module.exports = {
  displayName: 'mobile',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/*.spec.tsx'],
  setupFiles: ['<rootDir>/src/test-setup.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': [
      'babel-jest',
      { configFile: path.join(__dirname, '.babelrc.js') },
    ],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(@react-navigation|zustand)/)',
  ],
};
