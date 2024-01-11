const { REACT_APP__DEFAULT_PAIR = '' } = import.meta.env;

export const pageLinkMap = {
  [['/swap', REACT_APP__DEFAULT_PAIR].join('/')]: 'Swap',
  '/pools': 'Pools',
  [['/orderbook', REACT_APP__DEFAULT_PAIR].join('/')]: 'Orderbook',
  '/portfolio': 'Portfolio',
  '/bridge': 'Bridge',
};

export const defaultPage = Object.keys(pageLinkMap).at(0) ?? '/';
