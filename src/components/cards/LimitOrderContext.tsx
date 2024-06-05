import {
  Dispatch,
  ReactNode,
  SetStateAction,
  createContext,
  useMemo,
  useState,
} from 'react';
import {
  AllowedLimitOrderTypeKey,
  TimePeriod,
} from '../../lib/web3/utils/limitOrders';

interface FormState {
  amountIn: string;
  amountOut: string;
  limitPrice: string;
  timeAmount: string;
  timePeriod: TimePeriod;
  execution: AllowedLimitOrderTypeKey;
  slippagePercent: string;
}
interface FormSetState {
  setAmountInOut: Dispatch<SetStateAction<[string, string]>>;
  setLimitPrice: Dispatch<SetStateAction<FormState['limitPrice']>>;
  setTimeAmount: Dispatch<SetStateAction<FormState['timeAmount']>>;
  setTimePeriod: Dispatch<SetStateAction<FormState['timePeriod']>>;
  setExecution: Dispatch<SetStateAction<FormState['execution']>>;
  setSlippagePercent: Dispatch<SetStateAction<FormState['slippagePercent']>>;
}

export const LimitOrderFormContext = createContext<Partial<FormState>>({});
export const LimitOrderFormSetContext = createContext<Partial<FormSetState>>(
  {}
);

export function LimitOrderContextProvider({
  defaultExecutionType,
  children,
}: {
  defaultExecutionType: AllowedLimitOrderTypeKey;
  children: ReactNode;
}) {
  const [amountInOut, setAmountInOut] = useState<[string, string]>(['', '']);
  const [limitPrice, setLimitPrice] = useState('');
  const [timeAmount, setTimeAmount] = useState('1');
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('hours');
  const [execution, setExecution] = useState(defaultExecutionType);
  const [slippagePercent, setSlippagePercent] = useState('0.5');

  const state = useMemo(() => {
    const [amountIn, amountOut] = amountInOut;
    return {
      amountIn,
      amountOut,
      limitPrice,
      timeAmount,
      timePeriod,
      execution,
      slippagePercent,
    };
  }, [
    amountInOut,
    limitPrice,
    timeAmount,
    timePeriod,
    execution,
    slippagePercent,
  ]);

  const setState = useMemo(() => {
    return {
      setAmountInOut,
      setLimitPrice,
      setTimeAmount,
      setTimePeriod,
      setExecution,
      setSlippagePercent,
    };
  }, [
    setAmountInOut,
    setLimitPrice,
    setTimeAmount,
    setTimePeriod,
    setExecution,
    setSlippagePercent,
  ]);

  return (
    <LimitOrderFormContext.Provider value={state}>
      <LimitOrderFormSetContext.Provider value={setState}>
        {children}
      </LimitOrderFormSetContext.Provider>
    </LimitOrderFormContext.Provider>
  );
}
