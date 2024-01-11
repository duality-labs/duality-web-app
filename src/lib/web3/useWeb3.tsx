import { useContext } from 'react';
import { Web3Context } from './Web3Context';

export function useWeb3() {
  return useContext(Web3Context);
}
