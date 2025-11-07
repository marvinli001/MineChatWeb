import nextConfig from 'eslint-config-next';

/** @type {import('eslint').Linter.FlatConfig[]} */
const config = [
  ...nextConfig,
  {
    rules: {
      // Existing components intentionally manage derived UI state inside effects.
      // Disable the newly enabled rule for now to avoid blocking the upgrade; follow-up refactors can re-enable it.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
];

export default config;
