import {
  FormEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowRightArrowLeft,
  faArrowRotateLeft,
  faArrowUpFromBracket,
  faTrash,
  faEdit,
} from '@fortawesome/free-solid-svg-icons';
import BigNumber from 'bignumber.js';
import { Coin } from '@cosmjs/launchpad';

import {
  useBankBalances,
  useIndexerData,
  useShares,
  TickInfo,
  useIndexerPairData,
  getBalance,
  getPairID,
  hasInvertedOrder,
} from '../../lib/web3/indexerProvider';
import { useWeb3 } from '../../lib/web3/useWeb3';
import { FeeType, feeTypes } from '../../lib/web3/utils/fees';
import { useSimplePrice } from '../../lib/tokenPrices';

import {
  Token,
  useDualityTokens,
  useTokens,
} from '../../components/TokenPicker/hooks';
import RadioButtonGroupInput from '../../components/RadioButtonGroupInput/RadioButtonGroupInput';
import StepNumberInput from '../../components/StepNumberInput';
import TokenInputGroup from '../../components/TokenInputGroup';
import { useNumericInputState } from '../../components/inputs/NumberInput';

import useCurrentPriceFromTicks from '../../components/LiquiditySelector/useCurrentPriceFromTicks';
import LiquiditySelector, {
  Tick,
  TickGroup,
} from '../../components/LiquiditySelector';
import PriceDataDisclaimer from '../../components/PriceDataDisclaimer';

import './MyLiquidity.scss';
import { useEditLiquidity } from './useEditLiquidity';
import { getAmountInDenom } from '../../lib/web3/utils/tokens';
import { formatLongPrice, formatPrice } from '../../lib/utils/number';
import { calculateShares, priceToTickIndex } from '../../lib/web3/utils/ticks';
import { IndexedShare } from '../../lib/web3/utils/shares';
import SelectInput, { OptionProps } from '../../components/inputs/SelectInput';
import useFeeLiquidityMap from '../Pool/useFeeLiquidityMap';
import TokenPairLogos from '../../components/TokenPairLogos';
import { LiquidityShape, liquidityShapes } from '../../lib/web3/utils/shape';

const { REACT_APP__MAX_FRACTION_DIGITS = '' } = process.env;
const maxFractionDigits = parseInt(REACT_APP__MAX_FRACTION_DIGITS) || 20;
type FeeTypeAndAll = Omit<FeeType, 'fee'> & { fee: number | undefined };
const feeTypesLabelled: Array<FeeType> = [
  ...feeTypes.map(({ label, fee, description }) => ({
    label: `${label} Fee Tier`,
    fee,
    description,
  })),
];
const feeTypesAndAll: Array<FeeTypeAndAll> = [
  {
    label: 'All Fee Tiers',
    fee: undefined,
    description: '',
  },
  ...feeTypes.map(({ label, fee, description }) => ({
    label: `${label} Fee Tier`,
    fee,
    description,
  })),
];

const defaultFee = '0.30%';
const defaultFeeType = feeTypesLabelled.find(({ fee }) => {
  return fee === Number(defaultFee.match(/[\d.]+/)?.[0]) / 100;
});
const defaultPrecision = '6';
const defaultLiquidityShape =
  liquidityShapes.find(({ value }) => value === 'flat') ?? liquidityShapes[0];

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

// modify ticks only if difference is greater than our tolerance
const normalizationTolerance = Math.pow(10, -maxFractionDigits);

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

export default function MyLiquidity({
  tokenA: givenTokenA,
  tokenB: givenTokenB,
  valueA: givenValueA = '',
  valueB: givenValueB = '',
}: {
  tokenA?: Token;
  tokenB?: Token;
  valueA?: string;
  valueB?: string;
}) {
  const { wallet } = useWeb3();
  const { data: balances, isValidating } = useBankBalances();

  const { data: indexer } = useIndexerData();
  const { data: shares } = useShares();
  const dualityTokens = useDualityTokens();

  const [selectedTokens, setSelectedTokens] = useState<
    [Token, Token] | undefined
  >(() => {
    if (givenTokenA?.address && givenTokenB?.address) {
      return !hasInvertedOrder(
        getPairID(givenTokenA.address, givenTokenB.address),
        givenTokenA.address,
        givenTokenB.address
      )
        ? [givenTokenB, givenTokenA]
        : [givenTokenA, givenTokenB];
    } else {
      return undefined;
    }
  });

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

  // show detail page
  const [token0, token1] = selectedTokens || [];
  if (token0 && token0.address && token1 && token1.address) {
    return (
      <LiquidityDetailPage
        token0={token0}
        token1={token1}
        shares={shareValueMap?.[getPairID(token0.address, token1.address)]}
        valueA={givenValueA}
        valueB={givenValueB}
      />
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
    <div className="my-liquidity-page py-6">
      <div className="home-hero-section row px-6">
        <div className="credit-card my-4 py-2 px-3">
          <div className="credit-card__top-line row m-4">
            <div className="col font-brand">{address}</div>
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
      </div>
      <div className="position-cards row mt-5 px-6">
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

function LiquidityDetailPage({
  token0,
  token1,
  valueA: givenValueA = '',
  valueB: givenValueB = '',
  shares = [],
}: {
  token0: Token;
  token1: Token;
  valueA?: string;
  valueB?: string;
  shares?: TickShareValue[];
}) {
  const sharesLength = shares?.length || 1;

  const selectedTokens = useMemo(() => [token0, token1], [token0, token1]);
  const {
    data: [price0, price1],
  } = useSimplePrice(selectedTokens);

  const { data: { ticks } = {} } = useIndexerPairData(
    token0?.address,
    token1?.address
  );

  const currentPriceFromTicks0to1 = useCurrentPriceFromTicks(
    token0.address,
    token1.address
  );

  const [invertedTokenOrder, setInvertedTokenOrder] = useState<boolean>(() => {
    return currentPriceFromTicks0to1?.isLessThan(1) ?? false;
  });
  const swapAll = useCallback(() => {
    setInvertedTokenOrder((order) => !order);
    setWithdrawTypeSelected((withdrawType) => {
      switch (withdrawType) {
        case 'A':
          return 'B';
        case 'B':
          return 'A';
        default:
          return 'All';
      }
    });
  }, []);
  // calculate the graph extent based on the unfiltered lowest and highest tick prices
  const [minPrice0to1, maxPrice0to1] = useMemo<
    [BigNumber | undefined, BigNumber | undefined]
  >(() => {
    if (ticks) {
      const [minPrice0to1, maxPrice0to1] = ticks.reduce<
        [BigNumber | undefined, BigNumber | undefined]
      >(
        ([min, max], tick) => {
          return [
            !min || tick.price.isLessThan(min) ? tick.price : min,
            !max || tick.price.isGreaterThan(max) ? tick.price : max,
          ];
        },
        [undefined, undefined]
      );
      return [minPrice0to1, maxPrice0to1];
    }
    return [undefined, undefined];
  }, [ticks]);

  const [minPrice, maxPrice] = useMemo<[BigNumber, BigNumber] | []>(() => {
    return minPrice0to1 && maxPrice0to1
      ? [
          invertedTokenOrder
            ? new BigNumber(1).dividedBy(maxPrice0to1)
            : minPrice0to1,
          invertedTokenOrder
            ? new BigNumber(1).dividedBy(minPrice0to1)
            : maxPrice0to1,
        ]
      : [];
  }, [minPrice0to1, maxPrice0to1, invertedTokenOrder]);

  const currentPriceFromTicks = useMemo(() => {
    return invertedTokenOrder
      ? currentPriceFromTicks0to1 &&
          new BigNumber(1).dividedBy(currentPriceFromTicks0to1)
      : currentPriceFromTicks0to1;
  }, [invertedTokenOrder, currentPriceFromTicks0to1]);

  // note warning price, the price at which warning states should be shown
  // for one-sided liquidity this is the extent of data to one side
  const edgePrice =
    useMemo(() => {
      const allTicks = (ticks || [])
        .filter(
          (tick): tick is TickInfo =>
            tick?.reserve0.isGreaterThan(0) || tick?.reserve1.isGreaterThan(0)
        ) // filter to only ticks
        .sort((a, b) => a.price.comparedTo(b.price))
        .map((tick) => [tick.price, tick.reserve0, tick.reserve1]);

      const isReserveAZero = allTicks.every(([, reserveA]) =>
        reserveA.isZero()
      );
      const isReserveBZero = allTicks.every(([, , reserveB]) =>
        reserveB.isZero()
      );

      const startTick = allTicks[0];
      const endTick = allTicks[allTicks.length - 1];
      const edgePrice =
        (isReserveAZero && startTick?.[0]) ||
        (isReserveBZero && endTick?.[0]) ||
        undefined;
      return (
        edgePrice &&
        (invertedTokenOrder ? new BigNumber(1).dividedBy(edgePrice) : edgePrice)
      );
    }, [ticks, invertedTokenOrder]) || currentPriceFromTicks;

  const tokenA = invertedTokenOrder ? token1 : token0;
  const tokenB = invertedTokenOrder ? token0 : token1;

  const [totalA, totalB] = useMemo(() => {
    return shares.reduce<[BigNumber, BigNumber]>(
      ([totalA, totalB], shareValue) => {
        return invertedTokenOrder
          ? [
              totalA.plus(shareValue.userReserves1 || 0),
              totalB.plus(shareValue.userReserves0 || 0),
            ]
          : [
              totalA.plus(shareValue.userReserves0 || 0),
              totalB.plus(shareValue.userReserves1 || 0),
            ];
      },
      [new BigNumber(0), new BigNumber(0)]
    );
  }, [shares, invertedTokenOrder]);

  const [valueA, valueB] = useMemo(() => {
    return invertedTokenOrder
      ? [
          price1 ? totalA.multipliedBy(price1) : new BigNumber(0),
          price0 ? totalB.multipliedBy(price0) : new BigNumber(0),
        ]
      : [
          price0 ? totalA.multipliedBy(price0) : new BigNumber(0),
          price1 ? totalB.multipliedBy(price1) : new BigNumber(0),
        ];
  }, [totalA, totalB, invertedTokenOrder, price0, price1]);
  const isValueAZero = new BigNumber(valueA).isZero();
  const isValueBZero = new BigNumber(valueB).isZero();

  const [userTickSelected, setUserTickSelected] = useState(-1);
  // constrain the selected tick index if the index does no longer exist
  useEffect(() => {
    setUserTickSelected((selected) =>
      Math.min(selected, Number(sharesLength) - 1)
    );
  }, [sharesLength]);

  const [feeType, setFeeType] = useState<FeeTypeAndAll>(feeTypesAndAll[0]);

  const filteredShares = useMemo(() => {
    if (feeType.fee !== undefined) {
      const feeIndex = feeTypes.findIndex(({ fee }) => fee === feeType.fee);
      return feeIndex >= 0
        ? shares.filter(
            (share): share is TickShareValue => share.feeIndex === feeIndex
          )
        : [];
    }
    // don't filter shares if no fee tier was defined
    else {
      return shares;
    }
  }, [shares, feeType]);

  const sortedShares = useMemo(() => {
    return filteredShares.sort((a, b) => {
      // ascending by fee tier and then ascending by price
      return (
        a.feeIndex - b.feeIndex ||
        (invertedTokenOrder
          ? b.tick1.price.comparedTo(a.tick1.price)
          : a.tick0.price.comparedTo(b.tick0.price))
      );
    });
  }, [filteredShares, invertedTokenOrder]);

  const [userTicksAdd, setUserTicksUnprotected] = useState<TickGroup>([]);
  const userTicksEdit = useMemo<Array<Tick>>(() => {
    const forward = !invertedTokenOrder;
    return sortedShares.flatMap<Tick>((share) => {
      const {
        tick0,
        tick1,
        userReserves0,
        userReserves1,
        share: { tickIndex = '', feeIndex = '' },
      } = share;
      if (userReserves0 && userReserves1) {
        return forward
          ? [
              // add reserves0 as a tickA
              ...(userReserves0.isGreaterThan(0)
                ? [
                    {
                      reserveA: userReserves0,
                      reserveB: new BigNumber(0),
                      tickIndex: Number(tickIndex),
                      price: tick0.price,
                      fee: tick0.fee,
                      feeIndex: Number(feeIndex),
                      tokenA: tick0.token0,
                      tokenB: tick0.token1,
                    },
                  ]
                : []),
              // add reserves1 as a tickB
              ...(userReserves1.isGreaterThan(0)
                ? [
                    {
                      ...tick1,
                      reserveA: new BigNumber(0),
                      reserveB: userReserves1,
                      tickIndex: Number(tickIndex),
                      price: tick1.price,
                      fee: tick1.fee,
                      feeIndex: Number(feeIndex),
                      tokenA: tick1.token0,
                      tokenB: tick1.token1,
                    },
                  ]
                : []),
            ]
          : [
              // add reserves0 as a tickB
              ...(userReserves0.isGreaterThan(0)
                ? [
                    {
                      reserveA: new BigNumber(0),
                      reserveB: userReserves0,
                      tickIndex: -1 * Number(tickIndex),
                      price: new BigNumber(1).dividedBy(tick0.price),
                      fee: tick0.fee,
                      feeIndex: Number(feeIndex),
                      tokenA: tick0.token1,
                      tokenB: tick0.token0,
                    },
                  ]
                : []),
              // add reserves1 as a tickA
              ...(userReserves1.isGreaterThan(0)
                ? [
                    {
                      ...tick1,
                      reserveA: userReserves1,
                      reserveB: new BigNumber(0),
                      tickIndex: -1 * Number(tickIndex),
                      price: new BigNumber(1).dividedBy(tick1.price),
                      fee: tick1.fee,
                      feeIndex: Number(feeIndex),
                      tokenA: tick1.token1,
                      tokenB: tick1.token0,
                    },
                  ]
                : []),
            ];
      } else {
        return [];
      }
    });
  }, [sortedShares, invertedTokenOrder]);

  const [editingType, setEditingType] = useState<'add' | 'edit'>(
    givenValueA || givenValueB ? 'add' : 'edit'
  );
  const userTicks = editingType === 'add' ? userTicksAdd : userTicksEdit;

  const currentTick: Tick | undefined = userTicks[userTickSelected];
  const currentFeeType: FeeType | undefined =
    feeTypes[sortedShares[userTickSelected]?.feeIndex];

  const [editedUserTicks, setEditedUserTicks] = useState<Array<Tick>>(() =>
    userTicks.slice()
  );
  useEffect(() => {
    editingType === 'edit' && setEditedUserTicks(userTicks.slice());
  }, [editingType, userTicks]);

  const [, setInputValueA, tokenAValue = '0'] =
    useNumericInputState(givenValueA);
  const [, setInputValueB, tokenBValue = '0'] =
    useNumericInputState(givenValueB);
  const values = useMemo(
    (): [string, string] => [tokenAValue, tokenBValue],
    [tokenAValue, tokenBValue]
  );

  // reset when switching between modes
  // there is a lot going on, best to just remove the state
  useEffect(() => {
    if (editingType === 'edit') {
      setInputValueA(givenValueA);
      setInputValueB(givenValueB);
      setEditedUserTicks(userTicks);
    }
  }, [
    editingType,
    userTicks,
    setInputValueA,
    setInputValueB,
    givenValueA,
    givenValueB,
  ]);

  useLayoutEffect(() => {
    editingType === 'edit' &&
      setEditedUserTicks(() => {
        const [diffAValue, diffBValue] = getTickDiffCumulativeValues(
          userTicks,
          userTicks,
          values,
          editingType
        );

        // constrain the diff values to the users available shares
        const cappedDiffAValue = valueA.isLessThan(diffAValue)
          ? valueA
          : diffAValue;
        const cappedDiffBValue = valueB.isLessThan(diffBValue)
          ? valueB
          : diffBValue;

        // allow the new update to be conditionally adjusted
        let newUpdate;

        // modify only if difference is greater than our tolerance
        if (
          // if diff A is significant
          cappedDiffAValue
            ?.absoluteValue()
            .isGreaterThan(normalizationTolerance)
        ) {
          newUpdate = applyDiffToIndex(
            newUpdate || userTicks,
            userTicks,
            cappedDiffAValue,
            'reserveA',
            -1,
            diffAValue.isGreaterThan(0)
          );
        }
        if (
          // if diff B is significant
          cappedDiffBValue
            ?.absoluteValue()
            .isGreaterThan(normalizationTolerance)
        ) {
          newUpdate = applyDiffToIndex(
            newUpdate || userTicks,
            userTicks,
            cappedDiffBValue,
            'reserveB',
            -1,
            diffBValue.isGreaterThan(0)
          );
        }

        // default to no update if no normalization occurred
        return newUpdate || userTicks;
      });
  }, [values, userTicks, valueA, valueB, editingType]);

  const [reserveATotal, reserveBTotal] = useMemo(() => {
    return [
      editedUserTicks.reduce(
        (acc, tick) => acc.plus(tick.reserveA),
        new BigNumber(0)
      ),
      editedUserTicks.reduce(
        (acc, tick) => acc.plus(tick.reserveB),
        new BigNumber(0)
      ),
    ];
  }, [editedUserTicks]);

  const [chartTypeSelected, setChartTypeSelected] = useState<
    'AMM' | 'Orderbook'
  >('AMM');
  useEffect(() => {
    setEditedUserTicks(userTicks.slice());
  }, [chartTypeSelected, userTicks]);

  const [withdrawTypeSelected, setWithdrawTypeSelected] = useState<
    'All' | 'A' | 'B'
  >('All');

  const [rangeMin, setRangeMinUnprotected] = useState('1');
  const [rangeMax, setRangeMaxUnprotected] = useState('1');

  const setRangeMin = useCallback<React.Dispatch<React.SetStateAction<string>>>(
    (valueOrCallback) => {
      return setRangeMinUnprotected(
        editingType === 'add'
          ? valueOrCallback
          : (previousRangeMin) => {
              const rangeMin =
                typeof valueOrCallback === 'string'
                  ? valueOrCallback
                  : valueOrCallback(previousRangeMin);
              chartTypeSelected === 'AMM' &&
                setEditedUserTicks(() => {
                  return userTicks.map((tick) => {
                    return tick.price.isGreaterThanOrEqualTo(rangeMin) &&
                      tick.price.isLessThanOrEqualTo(rangeMax)
                      ? {
                          ...tick,
                          reserveA: new BigNumber(0),
                          reserveB: new BigNumber(0),
                        }
                      : tick;
                  });
                });
              return rangeMin;
            }
      );
    },
    [userTicks, rangeMax, editingType, chartTypeSelected]
  );
  const setRangeMax = useCallback<React.Dispatch<React.SetStateAction<string>>>(
    (valueOrCallback) => {
      return setRangeMaxUnprotected(
        editingType === 'add'
          ? valueOrCallback
          : (previousRangeMax) => {
              const rangeMax =
                typeof valueOrCallback === 'string'
                  ? valueOrCallback
                  : valueOrCallback(previousRangeMax);
              chartTypeSelected === 'AMM' &&
                setEditedUserTicks(() => {
                  return userTicks.map((tick) => {
                    return tick.price.isGreaterThanOrEqualTo(rangeMin) &&
                      tick.price.isLessThanOrEqualTo(rangeMax)
                      ? {
                          ...tick,
                          reserveA: new BigNumber(0),
                          reserveB: new BigNumber(0),
                        }
                      : tick;
                  });
                });
              return rangeMax;
            }
      );
    },
    [userTicks, rangeMin, editingType, chartTypeSelected]
  );
  const priceMin =
    withdrawTypeSelected === 'B'
      ? currentPriceFromTicks?.toFixed(4)
      : minPrice?.toFixed(4, BigNumber.ROUND_FLOOR);
  const priceMax =
    withdrawTypeSelected === 'A'
      ? currentPriceFromTicks?.toFixed(4)
      : maxPrice?.toFixed(4, BigNumber.ROUND_CEIL);
  useEffect(
    () => (!priceMin ? undefined : setRangeMinUnprotected(priceMin)),
    [priceMin]
  );
  useEffect(
    () => (!priceMax ? undefined : setRangeMaxUnprotected(priceMax)),
    [priceMax]
  );

  // hack: get effect of basic range selection to fire on switch of Basic/Pro
  useEffect(() => {
    if (chartTypeSelected === 'AMM') {
      priceMin && setRangeMinUnprotected(priceMin);
      priceMax && setRangeMaxUnprotected(priceMax);
    }
  }, [chartTypeSelected, priceMin, priceMax]);

  useEffect(() => {
    setTimeout(() => setRangeMin(rangeMin), 0);
  }, [chartTypeSelected, rangeMin, setRangeMin]);

  // ensure that setting of user ticks never goes outside our prescribed bounds
  const setUserTicks = useCallback<
    React.Dispatch<React.SetStateAction<TickGroup>>
  >(
    (userTicksOrCallback) => {
      function restrictTickPrices(tick: Tick): Tick {
        const { reserveA, reserveB, price } = tick;
        // restrict values to equal to or greater than 0
        const newReserveA = reserveA.isGreaterThan(0)
          ? reserveA
          : new BigNumber(0);
        const newReserveB = reserveB.isGreaterThan(0)
          ? reserveB
          : new BigNumber(0);

        if (priceMin && price.isLessThan(priceMin)) {
          const newPrice = new BigNumber(priceMin);
          return {
            ...tick,
            reserveA: newReserveA,
            reserveB: newReserveB,
            price: new BigNumber(priceMin),
            tickIndex: priceToTickIndex(newPrice).toNumber(),
          };
        }
        if (priceMax && price.isGreaterThan(priceMax)) {
          const newPrice = new BigNumber(priceMax);
          return {
            ...tick,
            reserveA: newReserveA,
            reserveB: newReserveB,
            price: new BigNumber(priceMax),
            tickIndex: priceToTickIndex(newPrice).toNumber(),
          };
        }
        return {
          ...tick,
          reserveA: newReserveA,
          reserveB: newReserveB,
        };
      }
      if (typeof userTicksOrCallback === 'function') {
        const userTicksCallback = userTicksOrCallback;
        return setUserTicksUnprotected((userTicks) => {
          return userTicksCallback(userTicks).map(restrictTickPrices);
        });
      }
      const userTicks = userTicksOrCallback;
      setUserTicksUnprotected(userTicks.map(restrictTickPrices));
    },
    [priceMin, priceMax]
  );

  const [liquidityShape, setLiquidityShape] = useState<LiquidityShape>(
    defaultLiquidityShape
  );
  const [precision, setPrecision] = useState<string>(defaultPrecision);
  // restrict precision to 2 ticks on double-sided liquidity mode
  useEffect(() => {
    setPrecision((precision) => {
      const precisionMin = !isValueAZero && !isValueBZero ? 2 : 1;
      return Number(precision) >= precisionMin ? precision : `${precisionMin}`;
    });
  }, [isValueAZero, isValueBZero]);

  const tickCount = Number(precision || 1);
  useEffect(() => {
    function getUserTicks(): TickGroup {
      const tickStart = new BigNumber(rangeMin);
      const tickEnd = new BigNumber(rangeMax);
      // set multiple ticks across the range
      const restrictedFeeType: FeeType | undefined =
        feeType.fee === undefined ? undefined : (feeType as FeeType);
      const feeIndex = restrictedFeeType
        ? feeTypes.findIndex(({ fee }) => fee === restrictedFeeType.fee)
        : -1;

      if (
        tokenA &&
        tokenB &&
        tickCount > 1 &&
        tickEnd.isGreaterThan(tickStart) &&
        restrictedFeeType &&
        feeIndex >= 0
      ) {
        const tokenAmountA = new BigNumber(values[0]);
        const tokenAmountB = new BigNumber(values[1]);
        // spread evenly after adding padding on each side
        if (tickStart.isZero() || tickEnd.isZero()) return [];

        // space new ticks by a multiplication ratio gap
        // use Math.pow becuse BigNumber does not support logarithm calculation
        // todo: use BigNumber logarithm compatible library to more accurately calculate tick spacing,
        //       with many ticks the effect of this precision may be quite noticable
        const tickGapRatio = new BigNumber(
          Math.pow(tickEnd.dividedBy(tickStart).toNumber(), 1 / (tickCount - 1))
        );
        const tickCounts: [number, number] = [0, 0];
        const tickPrices = Array.from({ length: tickCount }).reduceRight<
          Tick[]
        >((result, _, index, tickPrices) => {
          const lastPrice: BigNumber | undefined = result[0]?.price;
          const price = lastPrice?.isLessThan(edgePrice || 0)
            ? // calculate price from left (to have exact left value)
              tickStart.multipliedBy(tickGapRatio.exponentiatedBy(index))
            : // calculate price from right (to have exact right value)
              lastPrice?.dividedBy(tickGapRatio) ?? tickEnd;

          // choose whether token A or B should be added for the tick at this price
          const invertToken =
            isValueAZero || isValueBZero
              ? // enforce singe-sided liquidity has single ticks
                isValueBZero
              : // for double-sided liquidity split the ticks somewhere
              edgePrice
              ? // split the ticks at the current price if it exists
                price.isLessThan(edgePrice)
              : // split the ticks by index if no price exists yet
                index < tickPrices.length / 2;
          // add to count
          tickCounts[invertToken ? 0 : 1] += 1;
          const roundedPrice = new BigNumber(formatPrice(price.toFixed()));
          return [
            {
              reserveA: new BigNumber(invertToken ? 1 : 0),
              reserveB: new BigNumber(invertToken ? 0 : 1),
              price: roundedPrice,
              tickIndex: priceToTickIndex(roundedPrice).toNumber(),
              fee: new BigNumber(restrictedFeeType.fee),
              feeIndex: feeIndex,
              tokenA: tokenA,
              tokenB: tokenB,
            },
            ...result,
          ];
        }, []);

        const shapeFactor = (() => {
          return (() => {
            switch (liquidityShape.value) {
              case 'increasing':
                return tickPrices.map((_, index, tickPrices) => {
                  const percent = index / (tickPrices.length - 1);
                  return 1 + percent;
                });
              case 'normal':
                return tickPrices.map((_, index, tickPrices) => {
                  const percent = index / (tickPrices.length - 1);
                  return (
                    (1 / Math.sqrt(2 * Math.PI)) *
                    Math.exp(-(1 / 2) * Math.pow((percent - 0.5) / 0.25, 2))
                  );
                });
              case 'decreasing':
                return tickPrices.map((_, index, tickPrices) => {
                  const percent = 1 - index / (tickPrices.length - 1);
                  return 1 + percent;
                });
              case 'flat':
              default:
                return tickPrices.map(() => 1);
            }
          })();
        })();

        // normalise the tick amounts given
        return tickPrices.map((tick, index) => {
          return {
            ...tick,
            reserveA: tickCounts[0]
              ? tokenAmountA
                  .multipliedBy(shapeFactor[index])
                  .multipliedBy(tick.reserveA)
                  // normalize ticks to market value
                  .multipliedBy(edgePrice || 1)
              : new BigNumber(0),
            reserveB: tickCounts[1]
              ? tokenAmountB
                  .multipliedBy(shapeFactor[index])
                  .multipliedBy(tick.reserveB)
              : new BigNumber(0),
          };
        });
      }
      // set 1 tick in the middle of the range given
      else if (
        tokenA &&
        tokenB &&
        (tickCount === 1 || tickStart.isEqualTo(tickEnd)) &&
        restrictedFeeType &&
        feeIndex &&
        feeIndex >= 0
      ) {
        const price = tickStart.plus(tickEnd).dividedBy(2);
        const roundedPrice = new BigNumber(formatPrice(price.toFixed()));
        const isValueA =
          !isValueAZero && !isValueBZero
            ? edgePrice?.isGreaterThan(price) || isValueAZero
            : !isValueAZero;
        return [
          {
            reserveA: new BigNumber(isValueA ? 1 : 0),
            reserveB: new BigNumber(isValueA ? 0 : 1),
            price: roundedPrice,
            tickIndex: priceToTickIndex(roundedPrice).toNumber(),
            fee: new BigNumber(restrictedFeeType.fee),
            feeIndex: feeIndex,
            tokenA: tokenA,
            tokenB: tokenB,
          },
        ];
      }
      // or set no ticks
      else {
        return [];
      }
    }

    setUserTicks?.((userTicks) => {
      const newUserTicks = getUserTicks();

      // check if number of ticks are equal or value in ticks are equal
      if (
        userTicks.length !== newUserTicks.length ||
        !newUserTicks.every((newUserTick, ticksIndex) => {
          const userTick = userTicks[ticksIndex];
          return (
            newUserTick.feeIndex === userTick.feeIndex &&
            newUserTick.tickIndex === userTick.tickIndex &&
            newUserTick.reserveA.isEqualTo(userTick.reserveA) &&
            newUserTick.reserveB.isEqualTo(userTick.reserveB)
          );
        })
      ) {
        // return changed values
        return newUserTicks;
      } else {
        // return same values
        return userTicks;
      }
    });
  }, [
    values,
    isValueAZero,
    isValueBZero,
    feeType,
    tokenA,
    tokenB,
    liquidityShape,
    rangeMin,
    rangeMax,
    tickCount,
    edgePrice,
    setUserTicks,
  ]);

  const leftColumn = (
    <div className="col">
      <div className="">
        <div className="chart-header row my-4">
          <div className="col">
            <div className="row flex-centered gap-3">
              <TokenPairLogos className="h4" tokenA={tokenA} tokenB={tokenB} />

              <h2 className="h4">
                {tokenA.display.toUpperCase()} / {tokenB.display.toUpperCase()}
              </h2>
              <button
                type="button"
                className="ml-auto icon-button h4"
                onClick={swapAll}
              >
                <FontAwesomeIcon icon={faArrowRightArrowLeft}></FontAwesomeIcon>
              </button>
            </div>
          </div>
          <div className="col flex-centered ml-auto">
            <div className="row gap-2">
              <div>Current Price</div>
              <div className="current-price">
                {currentPriceFromTicks?.toFixed(5) ?? '-'}
              </div>
              {tokenA && tokenB && (
                <div>
                  {tokenA.display.toUpperCase()} per{' '}
                  {tokenB.display.toUpperCase()}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex row chart-area my-liquidity-chart">
          <LiquiditySelector
            advanced={chartTypeSelected === 'Orderbook'}
            tokenA={tokenA}
            tokenB={tokenB}
            ticks={ticks}
            feeTier={feeType?.fee}
            // setFeeTier={setFeeTier}
            // currentPriceFromTicks={currentPriceFromTicks}
            userTickSelected={userTickSelected}
            setUserTickSelected={setUserTickSelected}
            userTicks={editedUserTicks}
            userTicksBase={userTicks}
            // setUserTicks={useCallback(
            //   (
            //     callback: (
            //       userTicks: TickGroup,
            //       meta?: { index?: number }
            //     ) => TickGroup
            //   ): void => {
            //     setEditedUserTicks((currentEditedUserTicks) => {
            //       // bail if bad state: the editedUserTicks and current userTicks do not match
            //       if (
            //         !userTicks ||
            //         !currentEditedUserTicks ||
            //         userTicks.length !== currentEditedUserTicks.length
            //       ) {
            //         return currentEditedUserTicks;
            //       }
            //       const meta: { index?: number } = {};
            //       const newEditedUserTicks = callback(currentEditedUserTicks, meta);
            //       const indexSelected = meta.index !== undefined ? meta.index : -1;
            //       // normalise to value
            //       const newEditedUserTick = newEditedUserTicks?.[indexSelected];
            //       const currentEditedUserTick =
            //         currentEditedUserTicks?.[indexSelected];
            //       const oldUserTick = userTicks?.[indexSelected];
            //       // bail if no current selection
            //       if (
            //         !newEditedUserTick ||
            //         !currentEditedUserTick ||
            //         !oldUserTick
            //       ) {
            //         return currentEditedUserTicks;
            //       }

            //       const newUpdate = currentEditedUserTicks.map((tick, index) => {
            //         return index === indexSelected ?
            //       })

            //       // find how much correction needs to be applied to meet the current goal
            //       const [diffAValue, diffBValue] = getTickDiffCumulativeValues(
            //         newEditedUserTicks,
            //         userTicks,
            //         values,
            //         editingType
            //       );

            //       // allow the new update to be conditionally adjusted
            //       let newUpdate: TickGroup | undefined;

            //       // modify only if difference is greater than our tolerance
            //       if (
            //         // if diff A is significant
            //         diffAValue
            //           ?.absoluteValue()
            //           .isGreaterThan(normalizationTolerance) &&
            //         // if value isn't trying to go negative
            //         !(
            //           newEditedUserTick.reserveA.isNegative() &&
            //           currentEditedUserTick.reserveA.isZero()
            //         )
            //       ) {
            //         newUpdate = applyDiffToIndex(
            //           newUpdate || newEditedUserTicks,
            //           userTicks,
            //           diffAValue,
            //           'reserveA',
            //           indexSelected,
            //           editingType === 'add'
            //         );
            //       }
            //       if (
            //         // if diff B is significant
            //         diffBValue
            //           ?.absoluteValue()
            //           .isGreaterThan(normalizationTolerance) &&
            //         // if value isn't trying to go negative
            //         !(
            //           newEditedUserTick.reserveB.isNegative() &&
            //           currentEditedUserTick.reserveB.isZero()
            //         )
            //       ) {
            //         newUpdate = applyDiffToIndex(
            //           newUpdate || newEditedUserTicks,
            //           userTicks,
            //           diffBValue,
            //           'reserveB',
            //           indexSelected,
            //           editingType === 'add'
            //         );
            //       }

            //       // default to no update if no normalization occurred
            //       return newUpdate || currentEditedUserTicks;
            //     });
            //   },
            //   [editingType, values, userTicks]
            // )}
            setUserTicks={setEditedUserTicks}
            rangeMin={rangeMin}
            rangeMax={rangeMax}
            setRangeMin={setRangeMin}
            setRangeMax={setRangeMax}
            // swapAll={swapAll}
            canMoveUp
            canMoveDown
            // submitButtonText={submitButtonSettings[editingType].text}
            // submitButtonVariant={submitButtonSettings[editingType].variant}
          />
        </div>
      </div>
      <div className="row mt-2 gap-4 flex-centered hide">
        <div className="col pb-3" style={{ width: '8em', textAlign: 'right' }}>
          Shown Fee Tier:
        </div>
        <div className="col flex">
          <SelectInput<FeeTypeAndAll>
            className="col flex select-fee-tier"
            list={feeTypesAndAll}
            value={feeType}
            onChange={setFeeType}
            getLabel={(feeType) => (feeType ? feeType.label : 'All Fee Tiers')}
            getDescription={(feeType) =>
              !(feeType && feeType.fee !== undefined) ? null : (
                <>
                  <span>{feeType.description}</span>
                  <span> </span>
                  <span className="badge">
                    {feeLiquidityMap?.[feeType.fee]
                      .multipliedBy(100)
                      .toFixed(0) ?? '0'}
                    % of Liquidity
                  </span>
                </>
              )
            }
          />
        </div>
      </div>
      {chartTypeSelected === 'AMM' && (
        <>
          <div className="row mt-2 gap-4 flex-centered hide">
            <div
              className="col pb-0"
              style={{ width: '8em', textAlign: 'right' }}
            >
              Withdraw:
            </div>
            <div className="col flex">
              <RadioButtonGroupInput<'All' | 'A' | 'B'>
                className="chart-type-input"
                values={{
                  All: 'All',
                  A: tokenA.display.toUpperCase(),
                  B: tokenB.display.toUpperCase(),
                }}
                value={withdrawTypeSelected}
                onChange={setWithdrawTypeSelected}
              />
            </div>
          </div>
          <div className="row mt-2 gap-4 flex-centered hide">
            Drag range to select liquidity pools to withdraw
          </div>
        </>
      )}
      <div
        className={[
          'price-card mt-4',
          // chartTypeSelected === 'Orderbook' && 'hide',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <div className="card-row">
          <StepNumberInput
            className="flex"
            title="MIN PRICE"
            value={rangeMin}
            onChange={setRangeMin}
            // stepFunction={logarithmStep}
            pressedDelay={500}
            pressedInterval={100}
            min={
              priceMin &&
              Math.min(Number(priceMin), Number(rangeMax)).toFixed(8)
            }
            max={rangeMax}
            description={
              tokenA && tokenB
                ? `${tokenA.symbol} per ${tokenB.symbol}`
                : 'No Tokens'
            }
            minSignificantDigits={8}
            maxSignificantDigits={10}
            // format={formatStepNumberPriceInput}
          />
          <StepNumberInput
            className="flex"
            title="MAX PRICE"
            value={rangeMax}
            onChange={setRangeMax}
            // stepFunction={logarithmStep}
            pressedDelay={500}
            pressedInterval={100}
            min={rangeMin}
            max={
              priceMax &&
              Math.max(Number(priceMax), Number(rangeMin)).toFixed(8)
            }
            description={
              tokenA && tokenB
                ? `${tokenA.symbol} per ${tokenB.symbol}`
                : 'No Tokens'
            }
            minSignificantDigits={8}
            maxSignificantDigits={10}
            // format={formatStepNumberPriceInput}
          />
        </div>
      </div>

      {chartTypeSelected === 'Orderbook' && (
        <div className="row mt-4">
          <div className="col flex">
            <table style={{ width: '100%' }}>
              <tr>
                <th style={{ width: '7.5%' }}></th>
                <th style={{ width: '20%' }}>Price</th>
                <th style={{ width: '20%' }}>{tokenA.display.toUpperCase()}</th>
                <th style={{ width: '10%' }}></th>
                <th style={{ width: '20%' }}>{tokenB.display.toUpperCase()}</th>
                <th style={{ width: '10%' }}></th>
                <th style={{ width: '12.5%' }}>Actions</th>
              </tr>
              {editedUserTicks.map((tick, index) => {
                return tick.price.isGreaterThanOrEqualTo(rangeMin) &&
                  tick.price.isLessThanOrEqualTo(rangeMax) ? (
                  <tr key={index} className="pt-2">
                    <td>{index + 1}</td>
                    <td>{new BigNumber(tick.price.toFixed(5)).toFixed(5)}</td>
                    <td>
                      {tick.reserveA.isGreaterThan(1e-5)
                        ? tick.reserveA.toFixed(3)
                        : ''}
                    </td>
                    <td>
                      {tick.reserveA.isGreaterThan(1e-5)
                        ? `(${
                            reserveATotal.isGreaterThan(0)
                              ? new BigNumber(
                                  tick.reserveA
                                    .multipliedBy(100)
                                    .dividedBy(reserveATotal)
                                ).toFixed(1)
                              : 0
                          }%)`
                        : ''}
                    </td>
                    <td>
                      {tick.reserveB.isGreaterThan(1e-5)
                        ? tick.reserveB.toFixed(3)
                        : ''}
                    </td>
                    <td>
                      {tick.reserveB.isGreaterThan(1e-5)
                        ? `(${
                            reserveBTotal.isGreaterThan(0)
                              ? new BigNumber(
                                  tick.reserveB
                                    .multipliedBy(100)
                                    .dividedBy(reserveBTotal)
                                ).toFixed(1)
                              : 0
                          }%)`
                        : ''}
                    </td>
                    <td className="row gap-2 flex-end">
                      {tick &&
                        tick.reserveA
                          ?.plus(tick.reserveB || 0)
                          .isGreaterThan(0) &&
                        (tick.reserveA.isZero() || tick.reserveB.isZero()) && (
                          <button
                            type="button"
                            className="button button-secondary"
                          >
                            <FontAwesomeIcon icon={faEdit} />
                          </button>
                        )}
                      {tick &&
                        tick.reserveA
                          ?.plus(tick.reserveB || 0)
                          .isGreaterThan(0) && (
                          <button
                            type="button"
                            className="button button-error"
                            onClick={() => {
                              setEditedUserTicks((ticks) => {
                                return ticks.map((tick, currentTickIndex) => {
                                  return index !== currentTickIndex
                                    ? tick
                                    : {
                                        ...tick,
                                        reserveA: new BigNumber(0),
                                        reserveB: new BigNumber(0),
                                      };
                                });
                              });
                            }}
                          >
                            <FontAwesomeIcon
                              icon={
                                editingType === 'add'
                                  ? faTrash
                                  : faArrowUpFromBracket
                              }
                            />
                          </button>
                        )}
                      {tick &&
                        (!tick.reserveA.isEqualTo(userTicks[index]?.reserveA) ||
                          !tick.reserveB.isEqualTo(
                            userTicks[index]?.reserveB
                          )) && (
                          <button
                            type="button"
                            className="button button-default"
                            onClick={() => {
                              setEditedUserTicks((ticks) => {
                                return ticks.map((tick, currentTickIndex) => {
                                  return index !== currentTickIndex
                                    ? tick
                                    : {
                                        ...tick,
                                        reserveA: new BigNumber(
                                          userTicks[index].reserveA
                                        ),
                                        reserveB: new BigNumber(
                                          userTicks[index].reserveB
                                        ),
                                      };
                                });
                              });
                            }}
                          >
                            <FontAwesomeIcon icon={faArrowRotateLeft} />
                          </button>
                        )}
                    </td>
                  </tr>
                ) : null;
              })}
            </table>
          </div>
        </div>
      )}
      <div className="page-card orderbook-card mx-auto hide">
        <RadioButtonGroupInput<number>
          className="mx-auto mt-2 mb-4"
          buttonClassName="py-3 px-4"
          values={(() => {
            const map = new Map<number, string | number>();
            map.set(-1, 'All');
            for (let index = 0; index < Number(sharesLength); index++) {
              map.set(index, index + 1);
            }
            return map;
          })()}
          value={userTickSelected}
          onChange={(tickSelectedString) => {
            setUserTickSelected(tickSelectedString);
          }}
        />
        <div className="row">
          <div className="col">
            {currentTick && (
              <div className="row tick-price-card">
                <h3 className="card-title mr-auto">Price</h3>
                <StepNumberInput
                  key={userTickSelected}
                  readOnly
                  value={formatLongPrice(currentTick.price.toFixed())}
                />
              </div>
            )}
          </div>
          {currentFeeType && (
            <div className="col">
              <div className="fee-card">
                <div className="card-header">
                  <h3 className="card-title mr-auto">Fee Tier</h3>
                  <div className="badge-default corner-border badge-large ml-auto py-0">
                    {currentFeeType.label}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const { data: feeLiquidityMap } = useFeeLiquidityMap(
    tokenA?.address,
    tokenB?.address
  );

  const tokenList = useTokens();
  const { data: balances } = useBankBalances();
  const balanceTokenA =
    tokenA && balances && new BigNumber(getBalance(tokenA, balances));
  const balanceTokenB =
    tokenB && balances && new BigNumber(getBalance(tokenB, balances));

  const hasSufficientFundsA =
    balanceTokenA?.isGreaterThanOrEqualTo(tokenAValue || 0) || false;
  const hasSufficientFundsB =
    balanceTokenB?.isGreaterThanOrEqualTo(tokenBValue || 0) || false;

  const sharesDiff = useMemo(() => {
    // get relevant tick diffs
    const tickDiffs = getTickDiffs(editedUserTicks, userTicks);
    return tickDiffs
      .flatMap((tickDiff) => {
        const tickIndex = invertedTokenOrder
          ? tickDiff.tickIndex * -1
          : tickDiff.tickIndex;
        const share = filteredShares.find((share) => {
          return share.share.tickIndex === `${tickIndex}`;
        });
        if (!share) {
          return [];
        }
        return {
          ...share,
          // // realign tickDiff A/B back to original shares 0/1 order
          tickDiff0: invertedTokenOrder ? tickDiff.reserveB : tickDiff.reserveA,
          tickDiff1: invertedTokenOrder ? tickDiff.reserveA : tickDiff.reserveB,
        };
      })
      .filter(
        (share) => !share.tickDiff0.isZero() || !share.tickDiff1.isZero()
      );
  }, [editedUserTicks, userTicks, invertedTokenOrder, filteredShares]);

  // const [{ submitButtonVariant, submitButtonText }, setSubmitButtonState] = useState(() => ({ submitButtonVariant: 'primary', submitButtonText: 'No Change' }));

  const diffTokenA = useMemo(
    () =>
      sharesDiff.reduce(
        !invertedTokenOrder
          ? (acc, shareDiff) => acc.plus(shareDiff.tickDiff0)
          : (acc, shareDiff) => acc.plus(shareDiff.tickDiff1),
        new BigNumber(0)
      ),
    [invertedTokenOrder, sharesDiff]
  );
  const diffTokenB = useMemo(
    () =>
      sharesDiff.reduce(
        !invertedTokenOrder
          ? (acc, shareDiff) => acc.plus(shareDiff.tickDiff1)
          : (acc, shareDiff) => acc.plus(shareDiff.tickDiff0),
        new BigNumber(0)
      ),
    [invertedTokenOrder, sharesDiff]
  );
  const noChange = diffTokenA.abs().plus(diffTokenB.abs()).isLessThan(10e-9);

  const submitButtonVariant = noChange ? 'primary' : 'primary';

  const submitButtonText = noChange
    ? 'No Change'
    : [
        (diffTokenA.isGreaterThan(0) || diffTokenB.isGreaterThan(0)) &&
          `Deposit ${[
            diffTokenA.isGreaterThan(0) && tokenA.display.toUpperCase(),
            diffTokenB.isGreaterThan(0) && tokenB.display.toUpperCase(),
          ]
            .filter(Boolean)
            .join(', ')}`,
        (diffTokenA.isLessThan(0) || diffTokenB.isLessThan(0)) &&
          `Withdraw ${[
            diffTokenA.isLessThan(0) && tokenA.display.toUpperCase(),
            diffTokenB.isLessThan(0) && tokenB.display.toUpperCase(),
          ]
            .filter(Boolean)
            .join(', ')}`,
      ]
        .filter(Boolean)
        .join(' & ');

  useEffect(() => {
    if (editingType === 'add') {
      setFeeType((feeType) => {
        if (defaultFeeType && !feeType.fee) {
          return defaultFeeType;
        } else {
          return feeTypesLabelled.find(
            ({ fee }) => fee === feeType.fee
          ) as FeeType;
        }
      });
    }
  }, [editingType]);

  useEffect(() => {
    if (chartTypeSelected === 'AMM') {
      setPrecision(defaultPrecision);
    }
  }, [chartTypeSelected]);

  const rightColumn = (
    <div className="col col--left">
      <div className="row mb-3 gap-3">
        <div className="col flex">
          <RadioButtonGroupInput
            values={{
              add: 'Add Liquidity',
              edit:
                chartTypeSelected === 'Orderbook'
                  ? 'Edit Liquidity'
                  : 'Remove Liquidity',
            }}
            value={editingType}
            onChange={setEditingType}
          />
        </div>
        <div className="col flex">
          <RadioButtonGroupInput<'AMM' | 'Orderbook'>
            className="chart-type-input"
            values={{
              AMM: 'Basic',
              Orderbook: 'Pro',
            }}
            value={chartTypeSelected}
            onChange={setChartTypeSelected}
          />
        </div>
      </div>
      <div className="row">
        <SelectInput<FeeTypeAndAll>
          className="col flex select-fee-tier"
          list={editingType === 'edit' ? feeTypesAndAll : feeTypesLabelled}
          value={feeType}
          onChange={setFeeType}
          getLabel={(feeType) => (feeType ? feeType.label : 'All Fee Tiers')}
          getDescription={(feeType) =>
            !(feeType && feeType.fee !== undefined) ? null : (
              <>
                <span>{feeType.description}</span>
                <span> </span>
                <span className="badge">
                  {feeLiquidityMap?.[feeType.fee]
                    .multipliedBy(100)
                    .toFixed(0) ?? '0'}
                  % of Liquidity
                </span>
              </>
            )
          }
        />
      </div>
      <div
        className={[
          'assets-card',
          editingType === 'edit' && chartTypeSelected === 'AMM' && 'hide',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <div className="row my-2">Input:</div>
        <div className="card-row">
          <TokenInputGroup
            disabledToken
            // disabledInput={editingType === 'redistribute'}
            variant={!hasSufficientFundsA && 'error'}
            tokenList={tokenList}
            maxValue={balanceTokenA?.toNumber()}
            token={tokenA}
            value={
              editingType === 'edit'
                ? diffTokenA.isGreaterThan(0)
                  ? diffTokenA.toFixed(5)
                  : '0'
                : tokenAValue
            }
            onValueChanged={setInputValueA}
            exclusion={tokenB}
          />
        </div>
        <div className="plus-space mx-auto my-4"></div>
        <div className="card-row">
          <TokenInputGroup
            disabledToken
            // disabledInput={editingType === 'redistribute'}
            variant={!hasSufficientFundsB && 'error'}
            tokenList={tokenList}
            maxValue={balanceTokenB?.toNumber()}
            token={tokenB}
            value={
              editingType === 'edit'
                ? diffTokenB.isGreaterThan(0)
                  ? diffTokenB.toFixed(5)
                  : '0'
                : tokenBValue
            }
            onValueChanged={setInputValueB}
            exclusion={tokenA}
          />
        </div>
      </div>
      {editingType === 'edit' && chartTypeSelected === 'AMM' && (
        <>
          <div className="row gap-4 flex-centered">
            <div
              className="col pb-0 mt-3"
              style={{ width: '', textAlign: 'right' }}
            >
              Withdraw:
            </div>
            <div className="col flex">
              <RadioButtonGroupInput<'All' | 'A' | 'B'>
                className="chart-type-input"
                values={{
                  All: 'All',
                  A: tokenA.display.toUpperCase(),
                  B: tokenB.display.toUpperCase(),
                }}
                value={withdrawTypeSelected}
                onChange={setWithdrawTypeSelected}
              />
              <div className="row mt-2 gap-4 flex-centered">
                Drag range to select liquidity pools to withdraw
              </div>
            </div>
          </div>
        </>
      )}
      <div
        className={[
          'row my-4 pt-4 mx-auto gap-3 h3',
          editingType === 'add' && 'hide',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <div className="col">You will receive:</div>
        <div className="col">
          {diffTokenA.isLessThan(0) ? diffTokenA.abs().toFixed(5) : '0'}{' '}
          {tokenA.display.toUpperCase()},
        </div>
        <div className="col">
          {diffTokenB.isLessThan(0) ? diffTokenB.abs().toFixed(5) : '0'}{' '}
          {tokenB.display.toUpperCase()}
        </div>
      </div>
      <div
        className={['row', editingType !== 'add' && 'hide']
          .filter(Boolean)
          .join(' ')}
      >
        <div className="col flex">
          <div className="row mt-4">
            <div className="col">
              <h4 className="">Liquidity Shape</h4>
            </div>
          </div>
          <SelectInput<LiquidityShape>
            className="col flex"
            maxColumnCount={4}
            list={liquidityShapes}
            value={liquidityShape}
            onChange={setLiquidityShape}
            getLabel={(feeType) =>
              feeType ? `${feeType.label}` : 'Select Fee Tier'
            }
            open={chartTypeSelected === 'Orderbook'}
            OptionComponent={LiquidityShapeOptionComponent}
          />
          {chartTypeSelected === 'Orderbook' && (
            <div
              className="mb-4 p-4 orderbook-card"
              style={{ borderRadius: 6, marginTop: -20 }}
            >
              <div className="row flex-centered">
                <div className="col mr-auto">
                  <div className="card-titles mt-1 mr-auto">
                    Number of Ticks
                  </div>
                </div>
                <div className="col ml-auto">
                  <div className="row mt-1 gap-2">
                    <div className="col">
                      <StepNumberInput
                        className="smalll"
                        editable={false}
                        min={
                          rangeMin === rangeMax
                            ? 1
                            : !isValueAZero && !isValueBZero
                            ? 2
                            : 1
                        }
                        max={rangeMin === rangeMax ? 1 : 10}
                        value={rangeMin === rangeMax ? '1' : precision}
                        onChange={setPrecision}
                        minSignificantDigits={1}
                      />
                    </div>
                    <div className="col">
                      <button
                        type="button"
                        className="button-info ml-2"
                        onClick={() => setPrecision(defaultPrecision)}
                      >
                        Auto
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="row my-4">
        <input
          className={`button-${submitButtonVariant} text-medium flex mx-auto px-4 py-4`}
          disabled={
            editingType === 'add'
              ? !(Number(tokenAValue) + Number(tokenBValue) > 0)
              : noChange
          }
          type="submit"
          value={editingType === 'add' ? 'Deposit' : submitButtonText}
        />
      </div>
      <PriceDataDisclaimer tokenA={tokenA} tokenB={tokenB} />
    </div>
  );

  const [{ isValidating }, sendEditRequest] = useEditLiquidity();

  const onSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      // get relevant tick diffs
      await sendEditRequest(sharesDiff);
    },
    [sendEditRequest, sharesDiff]
  );

  return (
    <div className="my-liquidity-detail-page">
      <div className="banner hide">
        <div className="heading row">
          <div className="token-symbols col py-5">
            <h1>
              {tokenA.symbol} + {tokenB.symbol}
            </h1>
            {valueA && valueB && (
              <div className="balance row mt-4">
                <div className="col">Balance</div>
                <div className="col ml-auto">
                  ${valueA.plus(valueB).toFixed(2)}
                </div>
              </div>
            )}
            <div className="value-visual row">
              {valueA && valueB && (
                <div className="value-barchart">
                  <div
                    className="value-A"
                    style={{
                      width: `${valueA
                        .dividedBy(valueA.plus(valueB))
                        .multipliedBy(100)
                        .toFixed(3)}%`,
                    }}
                  ></div>
                  <div className="value-B"></div>
                </div>
              )}
            </div>
            <div className="value-text row">
              <div className="value-A col mr-5">
                {totalA.toFixed(3)} {tokenA.symbol}{' '}
                {valueA && <>(${valueA.toFixed(2)})</>}
              </div>
              <div className="value-B col ml-auto">
                {totalB.toFixed(3)} {tokenB.symbol}{' '}
                {valueB && <>(${valueB.toFixed(2)})</>}
              </div>
            </div>
          </div>
          <div className="token-icons col ml-auto">
            <div className="row">
              <img
                src={tokenA.logo_URIs?.svg || tokenA.logo_URIs?.png || ''}
                alt={`${tokenA.name} logo`}
              />
              <img
                src={tokenB.logo_URIs?.svg || tokenB.logo_URIs?.png || ''}
                alt={`${tokenB.name} logo`}
              />
            </div>
          </div>
        </div>
      </div>
      <div className="pool-page">
        <form
          className={['page-card chart-card', isValidating && '']
            .filter(Boolean)
            .join(' ')}
          style={{ display: 'block' }}
          onSubmit={onSubmit}
        >
          <div className="chart-header row flex-centered mb-4">
            <div className="col hide" style={{ width: '30em' }}>
              <RadioButtonGroupInput
                className="heading-buttons"
                buttonClassName="py-4 px-4 h3"
                values={{
                  add: 'Add Liquidity',
                  edit: 'Edit Liquidity',
                }}
                value={editingType}
                onChange={setEditingType}
              />
            </div>
            <div className="col">
              <h3 className="h3">
                {editingType
                  .split('')
                  .map((s, i) => (i > 0 ? s : s.toUpperCase()))
                  .join('')}{' '}
                Liquidity
              </h3>
            </div>
            <div className="col flex-centered chart-type-value">Customized</div>
            <div className="col ml-auto hide" style={{ width: '10em' }}>
              <RadioButtonGroupInput<'AMM' | 'Orderbook'>
                className="chart-type-input"
                values={{
                  AMM: 'Basic',
                  Orderbook: 'Pro',
                }}
                value={chartTypeSelected}
                onChange={setChartTypeSelected}
              />
            </div>
            <div className="col flex-centered ml-auto">Transaction Details</div>
          </div>
          <hr className="mt-3 mb-4 flex" />
          <div className="row">
            {leftColumn}
            {rightColumn}
          </div>
        </form>
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

function getTickDiffs(newTicks: TickGroup, oldTicks: TickGroup) {
  return oldTicks
    .map<Tick | undefined>((userTick, index) => {
      const editedUserTick = newTicks[index];
      // diff ticks
      if (editedUserTick && editedUserTick !== userTick) {
        return {
          ...userTick,
          reserveA: editedUserTick.reserveA.minus(userTick.reserveA),
          reserveB: editedUserTick.reserveB.minus(userTick.reserveB),
        };
        // edit all other values to ensure all diffs equal the desired value
      }
      return undefined;
    })
    .filter((tick): tick is Tick => !!tick);
}

function getTickDiffCumulativeValues(
  newTicks: TickGroup,
  oldTicks: TickGroup,
  tokenValueStrings: [string, string],
  editingType: 'redistribute' | 'add' | 'edit'
) {
  const [tokenAValueString, tokenBValueString] = tokenValueStrings;
  const tokenAValue =
    editingType !== 'redistribute'
      ? new BigNumber(tokenAValueString)
      : new BigNumber(0);
  const tokenBValue =
    editingType !== 'redistribute'
      ? new BigNumber(tokenBValueString)
      : new BigNumber(0);

  return getTickDiffs(newTicks, oldTicks).reduce(
    ([diffAValue, diffBValue], diffTick) => {
      return [
        diffAValue.plus(diffTick.reserveA),
        diffBValue.plus(diffTick.reserveB),
      ];
    },
    [new BigNumber(0).minus(tokenAValue), new BigNumber(0).minus(tokenBValue)]
  );
}

function applyDiffToIndex(
  newTicks: TickGroup,
  oldTicks: TickGroup,
  diffCorrectionValue: BigNumber,
  tickProperty: 'reserveA' | 'reserveB',
  tickIndexSelected: number,
  oldTickIsFloor = false
): TickGroup {
  const [adjustedUserTicks, remainder] = newTicks
    // add index onto the TickGroup to track tick order,
    // the result must be in the correct order
    .map<[Tick, number]>((tick, index) => [tick, index])
    // sort descending order (but with selected index at start, it will absorb the remainder)
    .sort(([a, aIndex], [b, bIndex]) => {
      const aIsSelected = aIndex === tickIndexSelected;
      const bIsSelected = bIndex === tickIndexSelected;
      return !aIsSelected && !bIsSelected
        ? // sort by descending value
          b[tickProperty].comparedTo(a[tickProperty])
        : // sort by selected index
        aIsSelected
        ? -1
        : 1;
    })
    .reduceRight(
      ([result, remainder], [tick, tickIndex], index) => {
        const tokenValue: BigNumber = tick[tickProperty];
        // set the floor to be non-selected 'add' ticks or zero
        const floor =
          oldTickIsFloor && tickIndexSelected !== tickIndex
            ? oldTicks[tickIndex]?.[tickProperty]
            : new BigNumber(0);
        // skip token ticks stuck to zero
        if (tokenValue.isEqualTo(0)) {
          return [result.concat([[tick, tickIndex]]), remainder];
        }
        // divided by remainder of ticks that aren't selected
        // which would be `index + 1` but it is `index + 1 - 1`
        // because we sorted the selectedTick to be in index 0.
        // when at index 0, the selected tick, attempt to take all the remainder
        const adjustment = remainder
          .negated()
          .dividedBy(index + 1 - (tickIndexSelected >= 0 ? 1 : 0) || 1);
        const newValue = tokenValue.plus(adjustment);
        const oldTick = oldTicks[tickIndex];
        const oldValue = oldTick[tickProperty];
        // abort change if new value is very close to the old value
        // (like a fraction of a percent difference) to avoid useless transactions
        if (
          oldValue
            .minus(newValue)
            .absoluteValue()
            .dividedBy(oldValue)
            .isLessThan(1e-6)
        ) {
          // insert old value into tick
          const newTick = { ...tick, [tickProperty]: oldValue };
          return [
            result.concat([[newTick, tickIndex]]),
            remainder.plus(adjustment),
          ];
        }
        // apply partial adjustment value using all liquidity of current tick
        if (newValue.isLessThan(floor)) {
          // insert new value (floor) into tick
          const currentValue = tick[tickProperty];
          const newTick = { ...tick, [tickProperty]: floor };
          // remove the applied adjustment from the remainder
          return [
            result.concat([[newTick, tickIndex]]),
            remainder.minus(currentValue.minus(floor)),
          ];
        }
        // apply all of calculated adjustment value
        else {
          // insert new value into tick
          const newTick = { ...tick, [tickProperty]: newValue };
          return [
            result.concat([[newTick, tickIndex]]),
            remainder.plus(adjustment),
          ];
        }
      },
      [[] as [Tick, number][], diffCorrectionValue]
    );

  if (remainder.isGreaterThan(normalizationTolerance)) {
    // eslint-disable-next-line no-console
    console.warn(
      'the correction tolerance has been exceeded, remainder: ',
      remainder.toNumber()
    );
  }

  return adjustedUserTicks
    .sort(([, aIndex], [, bIndex]) => aIndex - bIndex)
    .map(([tick]) => tick);
}

function LiquidityShapeOptionComponent({
  option: { icon, label },
}: OptionProps<LiquidityShape>) {
  return (
    <div className="col flex flex-centered mt-1 pt-3">
      <img src={icon} alt={label} height={36} />
      <div className="my-2">{label}</div>
    </div>
  );
}
