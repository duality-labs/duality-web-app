const { REACT_APP__DEFAULT_PAIR = '', REACT_APP__HIDE_ORDERBOOK = '' } =
  import.meta.env;

export const pageLinkMap = {
  [['/swap', REACT_APP__DEFAULT_PAIR].join('/')]: 'Swap',
  '/pools': 'Pools',
  // conditionally add the orderbook in
  ...(!REACT_APP__HIDE_ORDERBOOK && {
    [['/orderbook', REACT_APP__DEFAULT_PAIR].join('/')]: 'Orderbook',
  }),
  '/portfolio': 'Portfolio',
  '/bridge': 'Bridge',
};

export const defaultPage = Object.keys(pageLinkMap).at(0) ?? '/';
