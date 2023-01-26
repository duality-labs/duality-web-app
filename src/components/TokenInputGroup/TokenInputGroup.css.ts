import { style, styleVariants } from '@vanilla-extract/css';

const error = style({});
export const tokenInputGroupStyle = style({
  padding: '0.75rem 1.5rem 1rem',
  borderRadius: '1rem',
  border: '1px solid transparent',
  backgroundColor: 'var(--token-group)',
  gridTemplateColumns: 'auto 1fr',
  gridTemplateRows: 'auto 1fr auto',
  color: 'var(--default-alt)',
  display: 'grid',
  rowGap: '2px',
  selectors: {
    [`&.${error}`]: {
      color: 'var(--error)',
    },
  },
});

export const tokenInputGroupStyles = styleVariants({
  error: {
    border: '1px solid var(--error)',
  },
});

export const tokenInputGroupTitleStyle = style({
  selectors: {
    [`${tokenInputGroupStyles.error} &`]: {
      color: 'var(--error)',
    },
  },
});
