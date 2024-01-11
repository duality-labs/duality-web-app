import { expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders learn react link', () => {
  render(<App />);
  const dualityLogo = screen.getByAltText(/Duality/i);
  expect(dualityLogo).toBeDefined();
  expect(dualityLogo.tagName).toBe('IMG');
});
