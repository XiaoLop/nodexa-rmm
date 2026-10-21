import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Core SDK packages must stay language- and framework-neutral: they carry protocol
 * knowledge and state, not presentation. User-visible wording belongs to the apps.
 */
const LANGUAGE_NEUTRAL_PACKAGE_SOURCES = [
  'packages/control-client/src/**/*.{ts,tsx}',
  'packages/shared-state/src/**/*.{ts,tsx}',
  'packages/relay/src/**/*.{ts,tsx}',
];

const CJK_LITERAL_MESSAGE =
  'Core SDK packages must not contain Chinese UI text. Return structured data and translate it in apps/web or apps/app.';

const noRestrictedImport = (patterns, message) => [
  'error',
  {
    patterns: patterns.map((group) => ({ group: [group], message })),
  },
];

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/.expo/**',
      '**/android/**',
      '**/ios/**',
      // MeshCentral runtime-generated files
      'apps/meshcentral/runtime/**',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    files: LANGUAGE_NEUTRAL_PACKAGE_SOURCES,
    ignores: ['**/*.test.ts', '**/*.test.tsx', '**/testing/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/[\\u4e00-\\u9fff]/]',
          message: CJK_LITERAL_MESSAGE,
        },
        {
          selector: 'TemplateElement[value.raw=/[\\u4e00-\\u9fff]/]',
          message: CJK_LITERAL_MESSAGE,
        },
        {
          selector: 'JSXText[value=/[\\u4e00-\\u9fff]/]',
          message: CJK_LITERAL_MESSAGE,
        },
      ],
    },
  },
  {
    // The control client is transport-only: no UI framework, no app or state packages.
    files: ['packages/control-client/src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': noRestrictedImport(
        [
          'react',
          'react/*',
          'react-dom',
          'react-dom/*',
          'antd',
          'antd/*',
          'zustand',
          '@meshcentral/shared-state',
          '@meshcentral/relay',
        ],
        '`@meshcentral/control-client` must stay free of UI and app-level dependencies.',
      ),
    },
  },
  {
    // shared-state may use React bindings, but not DOM UI libraries or the relay.
    files: ['packages/shared-state/src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': noRestrictedImport(
        [
          'react-dom',
          'react-dom/*',
          'antd',
          'antd/*',
          '@meshcentral/relay',
          'expo',
          'expo/*',
          'react-native',
          'react-native/*',
        ],
        '`@meshcentral/shared-state` must not depend on DOM UI libraries or the relay.',
      ),
    },
  },
  {
    // The relay is a standalone protocol client; it must not pull in the control client.
    files: ['packages/relay/src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': noRestrictedImport(
        [
          '@meshcentral/control-client',
          '@meshcentral/shared-state',
          'react',
          'react-dom',
          'antd',
        ],
        '`@meshcentral/relay` must remain independent from app state and UI frameworks.',
      ),
    },
  },
  {
    // Web and mobile are separate delivery targets; never import one from the other.
    files: ['apps/web/src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': noRestrictedImport(
        ['@meshcentral/app', 'expo', 'expo/*', 'react-native', 'react-native/*'],
        '`apps/web` must not depend on the mobile app or React Native.',
      ),
    },
  },
  {
    files: ['apps/app/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': noRestrictedImport(
        ['@meshcentral/web'],
        '`apps/app` must not depend on the web application.',
      ),
    },
  },
);
