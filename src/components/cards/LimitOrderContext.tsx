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
  amount: string;
  limitPrice: string;
  triggerPrice: string;
  timeAmount: string;
  timePeriod: TimePeriod;
  execution: AllowedLimitOrderTypeKey;
  slippage: string;
}
interface FormSetState {
  setAmount: Dispatch<SetStateAction<FormState['amount']>>;
  setLimitPrice: Dispatch<SetStateAction<FormState['limitPrice']>>;
  setTriggerPrice: Dispatch<SetStateAction<FormState['triggerPrice']>>;
  setTimeAmount: Dispatch<SetStateAction<FormState['timeAmount']>>;
  setTimePeriod: Dispatch<SetStateAction<FormState['timePeriod']>>;
  setExecution: Dispatch<SetStateAction<FormState['execution']>>;
  setSlippage: Dispatch<SetStateAction<FormState['slippage']>>;
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
  const [amount, setAmount] = useState('');
  const [limitPrice, setLimitPrice] = useState('');
  const [triggerPrice, setTriggerPrice] = useState('');
  const [timeAmount, setTimeAmount] = useState('28');
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('days');
  const [execution, setExecution] = useState(defaultExecutionType);
  const [slippage, setSlippage] = useState('');

  const state = useMemo(() => {
    return {
      amount,
      limitPrice,
      triggerPrice,
      timeAmount,
      timePeriod,
      execution,
      slippage,
    };
  }, [
    amount,
    limitPrice,
    triggerPrice,
    timeAmount,
    timePeriod,
    execution,
    slippage,
  ]);

  const setState = useMemo(() => {
    return {
      setAmount,
      setLimitPrice,
      setTriggerPrice,
      setTimeAmount,
      setTimePeriod,
      setExecution,
      setSlippage,
    };
  }, [
    setAmount,
    setLimitPrice,
    setTriggerPrice,
    setTimeAmount,
    setTimePeriod,
    setExecution,
    setSlippage,
  ]);

  return (
    <LimitOrderFormContext.Provider value={state}>
      <LimitOrderFormSetContext.Provider value={setState}>
        {children}
      </LimitOrderFormSetContext.Provider>
    </LimitOrderFormContext.Provider>
  );
}
