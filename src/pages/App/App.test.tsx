import { expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders learn react link', () => {
  render(<App />);
  const page = screen.getAllByText(/Duality/i);
  expect(page[0]).toBeInTheDocument();
});
