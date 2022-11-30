import { useCallback } from 'react';
import BigNumber from 'bignumber.js';
import { faArrowRightArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import LiquiditySelector, {
  LiquiditySelectorProps,
} from '../LiquiditySelector';
import RadioInput from '../RadioInput';
import { FeeType, feeTypes } from '../../lib/web3/utils/fees';
import { Token } from '../TokenPicker/hooks';

interface AllTiers {
  label: 'All';
  fee: undefined;
  description: undefined;
}
const allTiers: AllTiers = {
  label: 'All',
  fee: undefined,
  description: undefined,
};
const feeTypesAndAll = [allTiers, ...feeTypes];

export default function LiquidityDistribution({
  chartTypeSelected = 'Orderbook',
  tokenA,
  tokenB,
  swapAll,
  setRangeMin,
  setRangeMax,
  ticks,
  tickSelected,
  setTickSelected,
  feeTier,
  setFeeTier,
  userTicks,
  userTicksBase,
  setUserTicks,
  currentPriceFromTicks,
  submitButtonText,
  submitButtonVariant = 'primary',
  canMoveUp,
  canMoveDown,
  canMoveX,
  viewOnlyUserTicks,
}: LiquiditySelectorProps & {
  chartTypeSelected: 'Orderbook' | 'AMM';
  tokenA: Token;
  tokenB: Token;
  swapAll: () => void;
  setFeeTier?: React.Dispatch<React.SetStateAction<number | undefined>>;
  currentPriceFromTicks: BigNumber;
  submitButtonText?: string;
  submitButtonVariant?: 'primary' | 'error' | 'warning';
}) {
  const setFeeType = useCallback<(feeType: FeeType | AllTiers) => void>(
    ({ fee }) => {
      setFeeTier?.(fee);
    },
    [setFeeTier]
  );

  return (
    <div
      className={`chart-card page-card row chart-type--${chartTypeSelected.toLowerCase()}`}
    >
      <div className="flex row">
        <div className="flex col col--left">
          <div className="chart-header row py-4">
            <h3 className="h3 text-normal">Liquidity Distribution</h3>
            <span className="tokens-badge badge-default badge-large font-console">
              {tokenB?.symbol}/{tokenA?.symbol}
            </span>
            <button type="button" className="icon-button" onClick={swapAll}>
              <FontAwesomeIcon icon={faArrowRightArrowLeft}></FontAwesomeIcon>
            </button>
          </div>
          {setFeeTier && (
            <div className="row pb-4">
              <div className="my-auto mr-3">Fee tier:</div>
              <RadioInput<FeeType | AllTiers>
                value={feeTypesAndAll.find(({ fee }) => fee === feeTier)}
                list={feeTypesAndAll}
                onChange={setFeeType}
                OptionComponent={({ option: { fee, label } }) => (
                  <div
                    key={fee}
                    className="button button-default card fee-type"
                  >
                    <h5 className="h5 fee-title">{label}</h5>
                  </div>
                )}
              />
            </div>
          )}
          <div className="flex row chart-area">
            <LiquiditySelector
              tokenA={tokenA}
              tokenB={tokenB}
              setRangeMin={setRangeMin}
              setRangeMax={setRangeMax}
              ticks={ticks}
              tickSelected={tickSelected}
              setTickSelected={setTickSelected}
              feeTier={feeTier}
              userTicksBase={userTicksBase}
              userTicks={userTicks}
              setUserTicks={setUserTicks}
              advanced={chartTypeSelected === 'AMM'}
              canMoveUp={canMoveUp}
              canMoveDown={canMoveDown}
              canMoveX={canMoveX}
              viewOnlyUserTicks={viewOnlyUserTicks}
            ></LiquiditySelector>
          </div>
        </div>
        <div className="col chart-price">
          <div className="hero-text my-4">
            {currentPriceFromTicks?.toFixed(5)}
          </div>
          <div>Current Price</div>
          {submitButtonText && (
            <div className="mt-auto mb-4">
              <input
                className={`button-${submitButtonVariant} mx-auto px-4 py-4`}
                type="submit"
                value={submitButtonText}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
