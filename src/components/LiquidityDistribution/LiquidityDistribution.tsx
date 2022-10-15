import BigNumber from 'bignumber.js';
import { faArrowRightArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import LiquiditySelector, {
  LiquiditySelectorProps,
} from '../LiquiditySelector';
import { Token } from '../TokenPicker/hooks';

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
  userTicks,
  userTicksBase,
  setUserTicks,
  formatPrice,
  currentPriceFromTicks,
  submitButtonText,
  submitButtonVariant = 'primary',
  canMoveUp,
  canMoveDown,
  canMoveX,
}: LiquiditySelectorProps & {
  chartTypeSelected: 'Orderbook' | 'AMM';
  tokenA: Token;
  tokenB: Token;
  swapAll: () => void;
  currentPriceFromTicks: BigNumber;
  submitButtonText?: string;
  submitButtonVariant?: 'primary' | 'error' | 'warning';
}) {
  return (
    <div
      className={`chart-card page-card row chart-type--${chartTypeSelected.toLowerCase()}`}
    >
      <div className="flex row">
        <div className="flex col col--left">
          <div className="chart-header row my-4">
            <h3 className="h3 text-normal">Liquidity Distribution</h3>
            <span className="tokens-badge badge-default badge-large font-console">
              {tokenB?.symbol}/{tokenA?.symbol}
            </span>
            <button type="button" className="icon-button" onClick={swapAll}>
              <FontAwesomeIcon icon={faArrowRightArrowLeft}></FontAwesomeIcon>
            </button>
          </div>
          <div className="flex row chart-area">
            <LiquiditySelector
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
              formatPrice={formatPrice}
              canMoveUp={canMoveUp}
              canMoveDown={canMoveDown}
              canMoveX={canMoveX}
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
