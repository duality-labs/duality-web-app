module.exports = {
  '**/*.{ts,tsx}': () => 'tsc --noEmit',
  '**/*.{js,jsx,ts,tsx,json,css,scss,md}': ['prettier --write'],
  '**/*.{js,jsx,ts,tsx}': ['eslint --max-warnings 0'],
};
