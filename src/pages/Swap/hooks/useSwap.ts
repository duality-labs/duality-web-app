import { useState } from 'react';
import { PairRequest, PairResult } from './index';

/**
 * Sends a transaction request
 * @param pairRequest the respective addresses and value
 * @returns result of request, loading state and possible error
 */
export function useSwap(request?: PairRequest): {
  data?: PairResult;
  isValidating: boolean;
  error?: string;
} {
  const [data] = useState<PairResult>();
  const [validating] = useState(false);
  const [error] = useState<string>();

  return { data, isValidating: validating, error };
}
