// eslint.config.js — ESLint v9 flat config for Vitrine Studio.
//
// The same rules as the other cartridges (they caught real bugs here):
//
//  • no-floating-promises  — an un-awaited write is how a scene half-saves
//  • no-empty              — a silent catch is the project's cardinal sin (CLAUDE rule 7)
//  • exhaustive-deps       — a stale closure is how a panel writes an old film over a new one
//  • no-explicit-any       — untyped bridge payloads are how a contract drifts
//
// Typed through tsconfig.eslint.json, which includes the tests (tsconfig.json
// leaves them out so shipping does not depend on vitest): one project for
// every file, no allowDefaultProject list with a match ceiling.
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'dev-fixtures/**', 'eslint.config.js', 'vite.config.ts'],
  },

  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.eslint.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      // An async JSX handler is idiomatic React: each one reports into its panel's error state.
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: { attributes: false } }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'no-empty': ['error', { allowEmptyCatch: false }],
      '@typescript-eslint/require-await': 'error',
      '@typescript-eslint/await-thenable': 'error',

      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
    },
  },

  // Tests reach into shapes on purpose to reproduce real bad data.
  {
    files: ['src/**/*.test.{ts,tsx}', 'src/test-setup.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/unbound-method': 'off',
      // A fake of an async dependency answers at once: async without await is the point.
      '@typescript-eslint/require-await': 'off',
    },
  },
);
