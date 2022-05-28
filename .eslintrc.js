module.exports = {
  extends: [
    'eslint:recommended',
    'react-app',
    'react-app/jest',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:jsx-a11y/recommended',
    'prettier',
  ],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'jsx-a11y'],
  root: true,
  rules: {
    'no-console': 'warn',
    'react/react-in-jsx-scope': 'off',
  },
};
