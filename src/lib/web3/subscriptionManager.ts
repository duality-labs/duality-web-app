import { createSubscriptionManager } from './events';

const { REACT_APP__WEBSOCKET_URL } = import.meta.env;

if (!REACT_APP__WEBSOCKET_URL)
  throw new Error('Invalid value for env variable REACT_APP__WEBSOCKET_URL');

const subscriber = createSubscriptionManager(REACT_APP__WEBSOCKET_URL);

export default subscriber;
