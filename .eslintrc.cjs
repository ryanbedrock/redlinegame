module.exports = {
  root: true,
  env: { browser: true, es2020: true, node: true },
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  ignorePatterns: [
    'dist',
    'node_modules',
    '.eslintrc.cjs',
    'vite.config.ts',
    'vitest.config.ts',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  plugins: ['react-refresh', 'react-hooks'],
  rules: {
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    'react-refresh/only-export-components': 'off',
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    '@typescript-eslint/no-explicit-any': 'error',
    'no-constant-condition': ['error', { checkLoops: false }],
  },
  overrides: [
    {
      // AC-2 (purity): the engine must be a pure, React-free module. No
      // non-determinism, no I/O imports, no clock. Enforced in CI.
      files: ['src/engine/**/*.ts'],
      excludedFiles: ['**/*.test.ts'],
      rules: {
        'no-restricted-globals': [
          'error',
          { name: 'Date', message: 'Engine must be pure: no Date/clock access (AC-2).' },
          { name: 'fetch', message: 'Engine must be pure: no I/O (AC-2).' },
          { name: 'localStorage', message: 'Engine must be pure: no I/O (AC-2).' },
        ],
        'no-restricted-properties': [
          'error',
          { object: 'Math', property: 'random', message: 'Engine must be deterministic: use the seeded RNG (AC-2).' },
          { object: 'Date', property: 'now', message: 'Engine must be pure: no clock access (AC-2).' },
        ],
        'no-restricted-syntax': [
          'error',
          { selector: "NewExpression[callee.name='Date']", message: 'Engine must be pure: no Date (AC-2).' },
        ],
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['react', 'react-dom', 'zustand', 'recharts', 'ajv', 'ajv-formats', 'fs', 'node:*'],
                message: 'Engine must be pure: no React/UI/I/O imports (AC-2).',
              },
            ],
          },
        ],
      },
    },
  ],
};
