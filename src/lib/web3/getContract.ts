import invariant from 'invariant';

import DualityCoreAbi from './abi/DualityCore.json';
import { ethers } from 'ethers';

invariant(
  process.env.REACT_APP__CONTRACT_ADDRESS__DUALITY_CORE,
  'DualityCore address not specified'
);

export const enum Contract {
  DUALITY_CORE,
}

const contractToAddress: Record<Contract, string> = {
  [Contract.DUALITY_CORE]:
    process.env.REACT_APP__CONTRACT_ADDRESS__DUALITY_CORE,
};

export function getContractAddress(contract: Contract) {
  return contractToAddress[contract];
}

const contractToAbi: Record<Contract, ethers.ContractInterface> = {
  [Contract.DUALITY_CORE]: DualityCoreAbi,
};

export default function getContract(
  contract: Contract,
  provider: ethers.providers.Provider
) {
  return new ethers.Contract(
    getContractAddress(contract),
    contractToAbi[contract],
    provider
  );
}
