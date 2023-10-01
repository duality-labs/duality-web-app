import {
  Dispatch,
  ReactNode,
  SetStateAction,
  createContext,
  useMemo,
  useState,
} from 'react';
import { LimitOrderType } from '@duality-labs/dualityjs/types/codegen/dualitylabs/duality/dex/tx';

export type LimitOrderTypeKeys = keyof Omit<
  typeof LimitOrderType,
  'UNRECOGNIZED'
>;

export const orderTypeTextMap: {
  [key in LimitOrderTypeKeys]: string;
} = {
  IMMEDIATE_OR_CANCEL: 'Immediate Or Cancel',
  FILL_OR_KILL: 'Fill Or Kill',
  GOOD_TIL_CANCELLED: 'Good Til Canceled',
  GOOD_TIL_TIME: 'Good Til Time',
  JUST_IN_TIME: 'Just In Time',
};

export const defaultExecutionType: LimitOrderTypeKeys = 'FILL_OR_KILL';

interface FormState {
  amount: string;
  limitPrice: string;
  triggerPrice: string;
  timeAmount: string;
  timePeriod: 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks';
  execution: LimitOrderTypeKeys;
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
  children,
}: {
  children: ReactNode;
}) {
  const [amount, setAmount] = useState('');
  const [limitPrice, setLimitPrice] = useState('');
  const [triggerPrice, setTriggerPrice] = useState('');
  const [timeAmount, setTimeAmount] = useState('');
  const [timePeriod, setTimePeriod] = useState<FormState['timePeriod']>('days');
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
