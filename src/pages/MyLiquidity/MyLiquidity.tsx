import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import BigNumber from 'bignumber.js';
import { Coin } from '@cosmjs/launchpad';

import {
  useBankBalances,
  useIndexerData,
  useShares,
  TickInfo,
  hasInvertedOrder,
} from '../../lib/web3/indexerProvider';
import { useWeb3 } from '../../lib/web3/useWeb3';
import { feeTypes } from '../../lib/web3/utils/fees';
import { useSimplePrice } from '../../lib/tokenPrices';

import {
  Token,
  useDualityTokens,
  useTokens,
} from '../../components/TokenPicker/hooks';

import './MyLiquidity.scss';
import { getAmountInDenom } from '../../lib/web3/utils/tokens';
import { calculateShares } from '../../lib/web3/utils/ticks';
import { IndexedShare } from '../../lib/web3/utils/shares';

interface ShareValue {
  share: IndexedShare;
  token0: Token;
  token1: Token;
  userReserves0?: BigNumber;
  userReserves1?: BigNumber;
}
interface TickShareValue extends ShareValue {
  feeIndex: number;
  tick0: TickInfo;
  tick1: TickInfo;
}
interface TickShareValueMap {
  [pairID: string]: Array<TickShareValue>;
}

function matchTokenDenom(denom: string) {
  return (token: Token) =>
    !!token.denom_units.find((unit) => unit.denom === denom);
}

// this is a function that exists in the backend
// but is not easily queried from here
// perhaps the backend could return these values on each Share object
export function getVirtualTickIndexes(
  tickIndex: number | string | undefined,
  feeIndex: number | string | undefined
): [number, number] | [] {
  const feePoints = feeTypes[Number(feeIndex)].fee * 10000;
  const middleIndex = Number(tickIndex);
  return feePoints && !isNaN(middleIndex)
    ? [middleIndex + feePoints, middleIndex - feePoints]
    : [];
}

export default function MyLiquidity() {
  const { wallet } = useWeb3();
  const { data: balances, isValidating } = useBankBalances();

  const { data: indexer } = useIndexerData();
  const { data: shares } = useShares();
  const dualityTokens = useDualityTokens();

  const [, setSelectedTokens] = useState<[Token, Token]>();

  const shareValueMap = useMemo(() => {
    if (shares && indexer) {
      return shares.reduce<TickShareValueMap>((result, share) => {
        const { pairId = '', tickIndex, feeIndex, sharesOwned } = share;
        // skip this share object if there are no shares owned
        if (feeIndex === undefined || !(Number(sharesOwned) > 0)) return result;
        const [tokenA, tokenB] = dualityTokens;
        const fee = feeTypes[Number(feeIndex)].fee;
        if (
          tokenA &&
          tokenA.address &&
          tokenB &&
          tokenB.address &&
          fee !== undefined
        ) {
          const inverted = hasInvertedOrder(
            pairId,
            tokenA.address,
            tokenB.address
          );
          const [token0, token1] = inverted
            ? [tokenB, tokenA]
            : [tokenA, tokenB];
          const extendedShare: ShareValue = { share, token0, token1 };
          const ticks = indexer[pairId]?.ticks || [];
          const [tickIndex1, tickIndex0] = getVirtualTickIndexes(
            tickIndex,
            feeIndex
          );
          if (tickIndex0 === undefined || tickIndex1 === undefined) {
            return result;
          }
          const tick0 = ticks.find(
            (tick) =>
              tick.feeIndex.isEqualTo(feeIndex) &&
              tick.tickIndex.isEqualTo(tickIndex0)
          );
          const tick1 = ticks.find(
            (tick) =>
              tick.feeIndex.isEqualTo(feeIndex) &&
              tick.tickIndex.isEqualTo(tickIndex1)
          );
          const totalShares =
            tick0 && tick1
              ? calculateShares({
                  price: tick0.price,
                  reserve0: tick0.reserve0,
                }).plus(
                  calculateShares({
                    price: tick1.price,
                    reserve1: tick1.reserve1,
                  })
                )
              : new BigNumber(0);
          // add optional tick data from indexer
          if (tick0 && tick1 && totalShares) {
            const shareFraction = new BigNumber(sharesOwned ?? 0).dividedBy(
              totalShares
            );
            extendedShare.userReserves0 = shareFraction.multipliedBy(
              // convert to big tokens
              getAmountInDenom(
                tick0.token0,
                tick0.reserve0,
                tick0.token0.address,
                tick0.token0.display
              ) || '0'
            );
            extendedShare.userReserves1 = shareFraction.multipliedBy(
              // convert to big tokens
              getAmountInDenom(
                tick1.token1,
                tick1.reserve1,
                tick1.token1.address,
                tick1.token1.display
              ) || '0'
            );
            // add TickShareValue to TickShareValueMap
            result[pairId] = result[pairId] || [];
            result[pairId].push({
              ...extendedShare,
              tick0,
              tick1,
              feeIndex: Number(feeIndex),
            });
          }
        }
        return result;
      }, {});
    }
  }, [shares, indexer, dualityTokens]);

  // show connect page
  if (!wallet || (!isValidating && (!balances || balances.length === 0))) {
    return (
      <div className="no-liquidity col">
        <h3 className="h2 mb-4 text-center"> No liquidity positions found</h3>
        <Link to="/add-liquidity">
          <button className="button button-info add-liquidity p-3 px-4">
            Add new liquidity
          </button>
        </Link>
      </div>
    );
  }

  return (
    <ShareValuesPage
      shareValueMap={shareValueMap}
      balances={balances}
      setSelectedTokens={setSelectedTokens}
    />
  );
}

function ShareValuesPage({
  shareValueMap,
  balances,
  setSelectedTokens,
}: {
  shareValueMap?: TickShareValueMap;
  balances?: Coin[];
  setSelectedTokens: React.Dispatch<
    React.SetStateAction<[Token, Token] | undefined>
  >;
}) {
  const { address } = useWeb3();

  const allUserSharesTokensList = useMemo<Token[]>(() => {
    // collect all tokens noted in each share
    const list = Object.values(shareValueMap || {}).reduce<Token[]>(
      (result, shareValues) => {
        shareValues.forEach((shareValue) => {
          result.push(shareValue.token0, shareValue.token1);
        });
        return result;
      },
      []
    );
    // return unique tokens
    return Array.from(new Set(list));
  }, [shareValueMap]);

  const allTokensList = useTokens();
  const allUserBankTokensList = useMemo<Token[]>(() => {
    return (balances || []).reduce<Token[]>((result, balance) => {
      const token = allTokensList.find(matchTokenDenom(balance.denom));
      if (token) {
        result.push(token);
      }
      return result;
    }, []);
  }, [balances, allTokensList]);

  const allUserTokensList = useMemo(() => {
    return [...allUserSharesTokensList, ...allUserBankTokensList];
  }, [allUserSharesTokensList, allUserBankTokensList]);

  const { data: allUserTokenPrices } = useSimplePrice(allUserTokensList);

  const allUserSharesValue = Object.values(shareValueMap || {}).reduce(
    (result, shareValues) => {
      const sharePairValue = shareValues.reduce((result2, shareValue) => {
        if (shareValue.userReserves0?.isGreaterThan(0)) {
          const token0Index = allUserTokensList.indexOf(shareValue.token0);
          result2 = result2.plus(
            shareValue.userReserves0.multipliedBy(
              allUserTokenPrices[token0Index] || 0
            )
          );
        }
        if (shareValue.userReserves1?.isGreaterThan(0)) {
          const token1Index = allUserTokensList.indexOf(shareValue.token1);
          result2 = result2.plus(
            shareValue.userReserves1.multipliedBy(
              allUserTokenPrices[token1Index] || 0
            )
          );
        }
        return result2;
      }, new BigNumber(0));
      return result.plus(sharePairValue);
    },
    new BigNumber(0)
  );

  const allUserBankValue = (balances || []).reduce(
    (result, { amount, denom }) => {
      const tokenIndex = allUserTokensList.findIndex(matchTokenDenom(denom));
      const token = allUserTokensList[tokenIndex] as Token | undefined;
      if (!token) return result;
      const tokenAmount =
        getAmountInDenom(token, amount, denom, token.display) || '0';
      const tokenPrice = allUserTokenPrices[tokenIndex];
      const tokenValue = new BigNumber(tokenAmount).multipliedBy(
        tokenPrice || 0
      );
      return result.plus(tokenValue);
    },
    new BigNumber(0)
  );

  // show loken list cards
  return (
    <div className="my-liquidity-page container py-6">
      <div className="home-hero-section row">
        <div className="credit-card my-4 py-2 px-3">
          <div className="credit-card__top-line row gap-3 m-4">
            <div className="col flex credit-card__name font-brand">
              {address}
            </div>
            <div className="col ml-auto font-brand">Duality</div>
          </div>
          <div className="row m-4">
            <div className="col">
              <div className="my-3">
                <h2 className="credit-card__hero-title">Portfolio Value</h2>
                <div className="credit-card__hero-value">
                  $
                  {allUserBankValue
                    .plus(allUserSharesValue)
                    .toNumber()
                    .toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                </div>
              </div>
              <div className="mt-3 mb-4 pb-3">
                <h3 className="credit-card__lesser-hero-title">
                  Available Tokens
                </h3>
                <div className="credit-card__lesser-hero-value">
                  $
                  {allUserSharesValue.toNumber().toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
              </div>
            </div>
            <div className="col ml-auto mt-auto">
              <a href="#deposit" className="button button-default hide">
                Deposit/Withdraw
              </a>
            </div>
          </div>
        </div>
        <div className="asset-list-card flex my-4 py-2 px-3"></div>
      </div>
      <div className="position-cards row mt-5">
        {shareValueMap &&
          Object.entries(shareValueMap).map(([pairID, shareValues]) => {
            return (
              <PositionCard
                key={pairID}
                token0={shareValues[0].token0}
                token1={shareValues[0].token1}
                shareValues={shareValues}
                setSelectedTokens={setSelectedTokens}
              />
            );
          })}
      </div>
    </div>
  );
}

function PositionCard({
  token0,
  token1,
  shareValues,
  setSelectedTokens,
}: {
  token0: Token;
  token1: Token;
  shareValues: Array<ShareValue>;
  setSelectedTokens: React.Dispatch<
    React.SetStateAction<[Token, Token] | undefined>
  >;
}) {
  const {
    data: [price0, price1],
  } = useSimplePrice([token0, token1]);
  if (token0 && token1) {
    const [total0, total1] = shareValues.reduce<[BigNumber, BigNumber]>(
      ([total0, total1], shareValue) => {
        return [
          total0.plus(shareValue.userReserves0 || 0),
          total1.plus(shareValue.userReserves1 || 0),
        ];
      },
      [new BigNumber(0), new BigNumber(0)]
    );
    const value0 = price0 && total0.multipliedBy(price0);
    const value1 = price1 && total1.multipliedBy(price1);

    return (
      <button
        className="position-card page-card"
        onClick={() => {
          setSelectedTokens([token0, token1]);
        }}
      >
        <div className="heading col">
          <div className="row">
            <div className="token-symbols col">
              {token0.symbol} +<br /> {token1.symbol}
            </div>
            <div className="token-icons col ml-auto">
              <div className="row">
                <img
                  src={token0.logo_URIs?.svg || token0.logo_URIs?.png || ''}
                  alt={`${token0.name} logo`}
                />
                <img
                  src={token1.logo_URIs?.svg || token1.logo_URIs?.png || ''}
                  alt={`${token1.name} logo`}
                />
              </div>
            </div>
          </div>
        </div>
        <div className="divider mb-4"></div>
        <div className="content mt-3">
          <div className="share-total">
            <div className="balance row">
              <div className="col">Balance</div>
              <div className="col ml-auto">
                {value0 && value1 && <>${value0.plus(value1).toFixed(2)}</>}
              </div>
            </div>
            <div className="value-visual row">
              {value0 && value1 && (
                <div className="value-barchart">
                  <div
                    className="value-A"
                    style={{
                      width: `${value0
                        .dividedBy(value0.plus(value1))
                        .multipliedBy(100)
                        .toFixed(3)}%`,
                    }}
                  ></div>
                  <div className="value-B"></div>
                </div>
              )}
            </div>
            <div className="value-text row">
              <div className="value-A col">
                {total0.toFixed(3)} {token0.symbol}{' '}
                {value0 && <>(${value0.toFixed(2)})</>}
              </div>
              <div className="value-B col ml-auto">
                {total1.toFixed(3)} {token1.symbol}{' '}
                {value1 && <>(${value1.toFixed(2)})</>}
              </div>
            </div>
          </div>
        </div>
      </button>
    );
  }
  return null;
}
