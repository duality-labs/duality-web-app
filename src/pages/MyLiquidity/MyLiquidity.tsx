import { Flex, Heading } from '@chakra-ui/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus } from '@fortawesome/free-solid-svg-icons';
import BigNumber from 'bignumber.js';

import { DexShare } from '../../lib/web3/generated/duality/nicholasdotsol.duality.dex/module/rest';
import {
  useBankBalances,
  useIndexerData,
  useShares,
  TickInfo,
  useIndexerPairData,
  TickMap,
  getBalance,
} from '../../lib/web3/indexerProvider';
import { useWeb3 } from '../../lib/web3/useWeb3';
import { feeTypes } from '../../lib/web3/utils/fees';
import { useHasPriceData, useSimplePrice } from '../../lib/tokenPrices';

import {
  Token,
  useDualityTokens,
  useTokens,
} from '../../components/TokenPicker/hooks';
import RadioButtonGroupInput from '../../components/RadioButtonGroupInput/RadioButtonGroupInput';
import StepNumberInput from '../../components/StepNumberInput';
import TokenInputGroup from '../../components/TokenInputGroup';

import LiquidityDistribution from '../../components/LiquidityDistribution';
import useCurrentPriceFromTicks from '../../components/LiquiditySelector/useCurrentPriceFromTicks';
import { Tick, TickGroup } from '../../components/LiquiditySelector';

import './MyLiquidity.scss';

interface ShareValue {
  share: DexShare;
  token0: Token;
  token1: Token;
  userReserves0?: BigNumber;
  userReserves1?: BigNumber;
}
interface TickShareValue extends ShareValue {
  tick: TickInfo;
}
interface TickShareValueMap {
  [pairID: string]: Array<TickShareValue>;
}

const defaultTokenAmount = '0';

export default function MyLiquidity() {
  const { wallet } = useWeb3();
  const { data: balances, isValidating } = useBankBalances();

  const { data: indexer } = useIndexerData();
  const { data: shares } = useShares();
  const dualityTokens = useDualityTokens();

  const [selectedTokens, setSelectedTokens] = useState<[Token, Token]>();

  const shareValueMap = useMemo(() => {
    if (shares && indexer) {
      return shares.reduce<TickShareValueMap>((result, share) => {
        const token0 = dualityTokens.find(
          (token) => token.address === share.token0
        );
        const token1 = dualityTokens.find(
          (token) => token.address === share.token1
        );
        if (token0 && token1) {
          const extendedShare: ShareValue = { share, token0, token1 };
          const pairID = `${share.token0}-${share.token1}`;
          const tickID = `${share.price}-${share.fee}`;
          const tick = indexer[pairID]?.ticks?.[tickID]?.find(Boolean);
          // add optional tick data from indexer
          if (tick && tick.totalShares.isGreaterThan(0)) {
            const shareFraction = new BigNumber(
              share.shareAmount ?? 0
            ).dividedBy(tick.totalShares);
            extendedShare.userReserves0 = shareFraction.multipliedBy(
              tick.reserve0
            );
            extendedShare.userReserves1 = shareFraction.multipliedBy(
              tick.reserve1
            );
            // add TickShareValue to TickShareValueMap
            result[pairID] = result[pairID] || [];
            result[pairID].push({ ...extendedShare, tick });
          }
        }
        return result;
      }, {});
    }
  }, [shares, indexer, dualityTokens]);

  // show connect page
  if (!wallet || (!isValidating && (!balances || balances.length === 0))) {
    return (
      <Flex
        className="no-liquidity"
        flexDirection="column"
        gap="1.25em"
        alignItems="center"
      >
        <Heading size="lg"> No liquidity positions found</Heading>
        <Link to="/add-liquidity">
          <button className="button button-info add-liquidity p-3 px-4">
            Add new liquidity
          </button>
        </Link>
      </Flex>
    );
  }

  // show detail page
  if (selectedTokens) {
    const [token0, token1] = selectedTokens;

    // get always up to date share data
    const shareValues =
      shareValueMap?.[`${token0.address}-${token1.address}`] || [];

    const [total0, total1] = shareValues.reduce<[BigNumber, BigNumber]>(
      ([total0, total1], shareValue) => {
        return [
          total0.plus(shareValue.userReserves0?.shiftedBy(12) || 0),
          total1.plus(shareValue.userReserves1?.shiftedBy(12) || 0),
        ];
      },
      [new BigNumber(0), new BigNumber(0)]
    );

    return (
      <div className="my-liquidity-detail-page">
        <div className="banner">
          <div className="heading row">
            <div className="token-symbols col py-5">
              <h1>
                {token0.symbol} + {token1.symbol}
              </h1>
              <div className="balance row mt-4">
                <div className="col">Balance</div>
                <div className="col ml-auto">
                  ${total0.plus(total1).toFixed(2)}
                </div>
              </div>
              <div className="value-visual row">
                {total0 && total1 && (
                  <div className="value-barchart">
                    <div
                      className="value-0"
                      style={{
                        width: `${total0
                          .dividedBy(total0.plus(total1))
                          .multipliedBy(100)
                          .toFixed(3)}%`,
                      }}
                    ></div>
                    <div className="value-1"></div>
                  </div>
                )}
              </div>
              <div className="value-text row">
                <div className="value-0 col mr-5">
                  {total0.toFixed(3)} {token0.symbol}{' '}
                  {total0 && <>(${total0.toFixed(2)})</>}
                </div>
                <div className="value-1 col ml-auto">
                  {total1.toFixed(3)} {token1.symbol}{' '}
                  {total1 && <>(${total1.toFixed(2)})</>}
                </div>
              </div>
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
        <LiquidityDistributionCard
          token0={token0}
          token1={token1}
          shares={shareValues}
        />
      </div>
    );
  }

  // show loken list cards
  return (
    <div className="my-liquidity-page">
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
  );
}

// set as constant to avoid unwanted hook effects
const defaultCurrentPrice = new BigNumber(1);
const defaultFeeTier = 0.003;
const setRangeMin = () => undefined;
const setRangeMax = () => undefined;

function LiquidityDistributionCard({
  token0,
  token1,
  shares = [],
}: {
  token0: Token;
  token1: Token;
  shares: Array<TickShareValue>;
}) {
  const precision = shares?.length || 1;

  const { data: { ticks: unorderedTicks } = {} } = useIndexerPairData(
    token0?.address,
    token1?.address
  );

  const currentPriceABFromTicks =
    useCurrentPriceFromTicks(unorderedTicks) || defaultCurrentPrice;

  const [invertedTokenOrder, setInvertedTokenOrder] = useState<boolean>(() => {
    return currentPriceABFromTicks?.isLessThan(1);
  });
  const swapAll = useCallback(() => {
    setInvertedTokenOrder((order) => !order);
  }, []);
  const tokenA = invertedTokenOrder ? token1 : token0;
  const tokenB = invertedTokenOrder ? token0 : token1;

  const currentPriceFromTicks = useMemo(() => {
    return invertedTokenOrder
      ? new BigNumber(1).dividedBy(currentPriceABFromTicks)
      : currentPriceABFromTicks;
  }, [invertedTokenOrder, currentPriceABFromTicks]);

  const ticks = useMemo(() => {
    if (!invertedTokenOrder) return unorderedTicks;
    if (!unorderedTicks) return unorderedTicks;
    // invert ticks
    const one = new BigNumber(1);
    return Object.entries(unorderedTicks).reduce<TickMap>(
      (result, [key, [tick0to1, tick1to0]]) => {
        // remap tick fields and invert the price
        result[key] = [
          tick1to0 && {
            ...tick1to0,
            price: one.dividedBy(tick1to0.price),
            reserve0: tick1to0.reserve1,
            reserve1: tick1to0.reserve0,
          },
          tick0to1 && {
            ...tick0to1,
            price: one.dividedBy(tick0to1.price),
            reserve0: tick0to1.reserve1,
            reserve1: tick0to1.reserve0,
          },
        ];
        return result;
      },
      {}
    );
  }, [unorderedTicks, invertedTokenOrder]);

  const [tickSelected, setTickSelected] = useState(-1);
  // constrain the selected tick index if the index does no longer exist
  useEffect(() => {
    setTickSelected((selected) => Math.min(selected, Number(precision) - 1));
  }, [precision]);

  const [feeTier, setFeeTier] = useState(defaultFeeTier);
  // change the liquidity view to the fee tier that the selected tick is on (so that we can see it)
  useEffect(() => {
    const feeTier = shares?.[tickSelected]?.tick.fee;
    if (feeTier) {
      setFeeTier(feeTier.toNumber());
    }
    // else default to most popular fee tier
    else if (shares && shares.length > 1) {
      const feeTierCount = shares.reduce<{ [feeTier: string]: number }>(
        (result, share) => {
          const feeTier = share.tick.fee.toFixed();
          if (feeTier) {
            result[feeTier] = result[feeTier] || 0;
            result[feeTier] += 1;
          }
          return result;
        },
        {}
      );
      const mostPopularFeeTier: string | undefined = Object.entries(
        feeTierCount
      ).sort((a, b) => {
        return b[1] - a[1]; // descending order by value
      })[0]?.[0];
      // set fee tier if found
      setFeeTier(Number(mostPopularFeeTier) || defaultFeeTier);
    }
    // else default to default fee tier
    else {
      setFeeTier(defaultFeeTier);
    }
  }, [shares, tickSelected]);

  const sortedShares = useMemo(() => {
    return shares.sort((a, b) => {
      // ascending by fee tier and then ascending by price
      return (
        a.tick.fee.comparedTo(b.tick.fee) ||
        (invertedTokenOrder
          ? b.tick.price.comparedTo(a.tick.price)
          : a.tick.price.comparedTo(b.tick.price))
      );
    });
  }, [shares, invertedTokenOrder]);

  const userTicks = useMemo<Array<Tick>>(() => {
    return sortedShares.flatMap(({ tick, userReserves0, userReserves1 }) => {
      if (userReserves0 && userReserves1) {
        return [
          invertedTokenOrder
            ? [
                new BigNumber(1).dividedBy(tick.price || new BigNumber(1)),
                userReserves1,
                userReserves0,
              ]
            : [tick.price || new BigNumber(0), userReserves0, userReserves1],
        ];
      } else {
        return [];
      }
    });
  }, [sortedShares, invertedTokenOrder]);

  const currentTick = userTicks[tickSelected];
  const currentFeeType = feeTypes.find(
    (feeType) => feeType.fee === sortedShares[tickSelected]?.tick.fee.toNumber()
  );

  const [editedUserTicks, setEditedUserTicks] = useState<Array<Tick>>(() =>
    userTicks.slice()
  );
  useEffect(() => {
    setEditedUserTicks(userTicks.slice());
  }, [userTicks]);

  const [editingType, setEditingType] = useState<
    'redistribute' | 'add' | 'remove'
  >('redistribute');

  const [values, setValues] = useState<[string, string]>(() => [
    new BigNumber(defaultTokenAmount).toFixed(),
    new BigNumber(defaultTokenAmount).toFixed(),
  ]);
  const [tokenAValue, tokenBValue] = values;

  useEffect(() => {
    if (editingType === 'add') {
      setEditedUserTicks((editedUserTicks) => {
        return editedUserTicks.map((editedUserTick, index) => {
          const userTick = userTicks[index];
          return editedUserTick
            ? [
                editedUserTick[0],
                userTick && editedUserTick[1].isLessThan(userTick[1])
                  ? userTick[1]
                  : editedUserTick[1],
                userTick && editedUserTick[2].isLessThan(userTick[2])
                  ? userTick[2]
                  : editedUserTick[2],
              ]
            : editedUserTick;
        });
      });
    } else if (editingType === 'remove') {
      setEditedUserTicks((editedUserTicks) => {
        return editedUserTicks.map((editedUserTick, index) => {
          const userTick = userTicks[index];
          return editedUserTick
            ? [
                editedUserTick[0],
                userTick && editedUserTick[1].isGreaterThan(userTick[1])
                  ? userTick[1]
                  : editedUserTick[1],
                userTick && editedUserTick[2].isGreaterThan(userTick[2])
                  ? userTick[2]
                  : editedUserTick[2],
              ]
            : editedUserTick;
        });
      });
    }
  }, [editingType, userTicks]);

  const leftColumn = (
    <div className="col">
      <LiquidityDistribution
        chartTypeSelected="AMM"
        tokenA={tokenA}
        tokenB={tokenB}
        ticks={ticks}
        feeTier={feeTier}
        currentPriceFromTicks={currentPriceFromTicks}
        tickSelected={tickSelected}
        setTickSelected={setTickSelected}
        userTicks={editedUserTicks}
        userTicksBase={userTicks}
        setUserTicks={useCallback(
          (
            callback: (
              userTicks: TickGroup,
              meta?: { index?: number }
            ) => TickGroup
          ): void => {
            setEditedUserTicks((currentEditedUserTicks) => {
              // bail if bad state: the editedUserTicks and current userTicks do not match
              if (
                !userTicks ||
                !currentEditedUserTicks ||
                userTicks.length !== currentEditedUserTicks.length
              ) {
                return currentEditedUserTicks;
              }
              const meta: { index?: number } = {};
              const newEditedUserTicks = callback(currentEditedUserTicks, meta);
              const indexSelected = meta.index !== undefined ? meta.index : -1;
              // normalise to value
              const newEditedUserTick = newEditedUserTicks?.[indexSelected];
              const currentEditedUserTick =
                currentEditedUserTicks?.[indexSelected];
              // bail if no current selection
              if (!newEditedUserTick || !currentEditedUserTick) {
                return currentEditedUserTicks;
              }

              const [tokenAValueString, tokenBValueString] = values;
              const tokenAValue =
                editingType !== 'redistribute'
                  ? new BigNumber(
                      editingType === 'remove'
                        ? `-${tokenAValueString}`
                        : tokenAValueString
                    ).shiftedBy(-12)
                  : new BigNumber(0);
              const tokenBValue =
                editingType !== 'redistribute'
                  ? new BigNumber(
                      editingType === 'remove'
                        ? `-${tokenBValueString}`
                        : tokenBValueString
                    ).shiftedBy(-12)
                  : new BigNumber(0);

              // find how much correction needs to be applied to meet the current goal
              const diffUserTicks = userTicks.map<Tick | undefined>(
                (userTick, index) => {
                  const editedUserTick = currentEditedUserTicks[index];
                  // diff ticks
                  if (editedUserTick && editedUserTick !== userTick) {
                    // find diff
                    const diffAValue = editedUserTick[1].minus(userTick[1]);
                    const diffBValue = editedUserTick[2].minus(userTick[2]);
                    return [userTick[0], diffAValue, diffBValue] as Tick;
                    // edit all other values to ensure all diffs equal the desired value
                  }
                  return undefined;
                }
              );
              const [diffAValue, diffBValue] = diffUserTicks
                .filter((tick): tick is Tick => !!tick)
                .reduce(
                  ([diffAValue, diffBValue], diffTick) => {
                    return [
                      diffAValue.plus(diffTick[1]),
                      diffBValue.plus(diffTick[2]),
                    ];
                  },
                  [
                    new BigNumber(0).minus(tokenAValue),
                    new BigNumber(0).minus(tokenBValue),
                  ]
                );

              // allow the new update to be conditionally adjusted
              let newUpdate = newEditedUserTicks;

              // modify only if difference is greater than our tolerance
              const normalizationTolerance = 1e-18;
              if (
                diffAValue &&
                diffAValue
                  ?.absoluteValue()
                  .isGreaterThan(normalizationTolerance)
              ) {
                newUpdate = applyDiffToIndex(newUpdate, diffAValue, 1);
              }
              if (
                diffBValue &&
                diffBValue
                  ?.absoluteValue()
                  .isGreaterThan(normalizationTolerance)
              ) {
                newUpdate = applyDiffToIndex(newUpdate, diffBValue, 2);
              }

              return newUpdate;

              function applyDiffToIndex(
                newEditedUserTicks: TickGroup,
                diffValue: BigNumber,
                tickPartIndex: number
              ): TickGroup {
                const [adjustedUserTicks, remainder] = newEditedUserTicks
                  // add index onto the TickGroup making it [price, tokenAValue, tokenBValue, index]
                  // to be able to track which tick is which, the result must be in the correct order
                  .map((tick, index) => tick.concat(new BigNumber(index)))
                  // sort descending order (but with selected index at start, it will absorb the remainder)
                  .sort((a, b) => {
                    const aIsSelected = a[3].isEqualTo(indexSelected);
                    const bIsSelected = b[3].isEqualTo(indexSelected);
                    return !aIsSelected && !bIsSelected
                      ? // sort by descending value
                        b[tickPartIndex].comparedTo(a[tickPartIndex])
                      : // sort by selected index
                      aIsSelected
                      ? -1
                      : 1;
                  })
                  .reduceRight(
                    ([result, remainder], tick, index) => {
                      const tokenValue: BigNumber = tick[tickPartIndex];
                      const floor =
                        editingType === 'add'
                          ? userTicks[tick[3].toNumber()]?.[tickPartIndex]
                          : new BigNumber(0);
                      // skip token ticks stuck to the floor
                      if (tokenValue.isEqualTo(floor)) {
                        return [result.concat([tick]), remainder];
                      }
                      // divided by remainder of ticks that aren't selected
                      // which would be `index + 1` but it is `index + 1 - 1`
                      // because we sorted the selectedTick to be in index 0.
                      // when at index 0, the selected tick, attempt to take all the remainder
                      const adjustment = remainder
                        .negated()
                        .dividedBy(index || 1);
                      const newValue = tokenValue.plus(adjustment);
                      // apply partial adjustment value using all liquidity of current tick
                      if (newValue.isLessThan(floor)) {
                        // insert new value (floor) into tick
                        const newTick = tick.slice() as Tick;
                        const [removedValue] = newTick.splice(
                          tickPartIndex,
                          1,
                          floor
                        );
                        // remove the applied adjustment from the remainder
                        return [
                          result.concat([newTick]),
                          remainder.minus(removedValue.minus(floor)),
                        ];
                      }
                      // apply all of calculated adjustment value
                      else {
                        // insert new value into tick
                        const newTick = tick.slice() as Tick;
                        newTick.splice(tickPartIndex, 1, newValue);
                        return [
                          result.concat([newTick]),
                          remainder.plus(adjustment),
                        ];
                      }
                    },
                    [[] as BigNumber[][], diffValue]
                  );

                if (remainder.isGreaterThan(normalizationTolerance)) {
                  // eslint-disable-next-line no-console
                  console.warn(
                    'the correction tolerance has been exceeded, remainder: ',
                    remainder.toNumber()
                  );
                }

                return adjustedUserTicks
                  .sort((a, b) => a[3].comparedTo(b[3]))
                  .map((tickAndIndex) => tickAndIndex.slice(0, 3) as Tick);
              }
            });
          },
          [editingType, values, userTicks]
        )}
        setRangeMin={setRangeMin}
        setRangeMax={setRangeMax}
        swapAll={swapAll}
        canMoveUp={['redistribute', 'add'].includes(editingType)}
        canMoveDown={['redistribute', 'remove'].includes(editingType)}
      />
      <div className="page-card orderbook-card mx-auto">
        <RadioButtonGroupInput<number>
          className="mx-auto mt-2 mb-4"
          buttonClassName="py-3 px-4"
          values={(() => {
            const map = new Map<number, string | number>();
            map.set(-1, 'All');
            for (let index = 0; index < Number(precision); index++) {
              map.set(index, index + 1);
            }
            return map;
          })()}
          value={tickSelected}
          onChange={(tickSelectedString) => {
            setTickSelected(tickSelectedString);
          }}
        />
        <div className="row">
          <div className="col">
            {currentTick && (
              <div className="row tick-price-card">
                <h3 className="card-title mr-auto">Price</h3>
                <StepNumberInput
                  key={tickSelected}
                  readOnly
                  value={currentTick[0].toFixed()}
                />
              </div>
            )}
          </div>
          {currentFeeType && (
            <div className="col">
              <div className="fee-card">
                <div className="card-header">
                  <h3 className="card-title mb-3 mr-auto">Fee Tier</h3>
                  <div className="badge-default corner-border badge-large font-console ml-auto">
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

  const hasPriceData = useHasPriceData([tokenA, tokenB]);
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

  const rightColumn = (
    <div className="col">
      <div className="assets-card page-card">
        <h3 className="card-title mb-3">Edit Liquidity</h3>
        <div className="mb-4">
          <RadioButtonGroupInput
            className="mx-auto mt-2 mb-4"
            buttonClassName="py-3 px-4"
            values={{
              redistribute: 'Redistribute',
              add: 'Add Liquidity',
              remove: 'Remove Liquidity',
            }}
            value={editingType}
            onChange={setEditingType}
          />
        </div>
        <div className="card-row">
          <TokenInputGroup
            variant={!hasSufficientFundsA && 'error'}
            tokenList={tokenList}
            token={tokenA}
            value={`${tokenAValue}`}
            onValueChanged={(newValue) =>
              setValues(([_, valueB]) => [newValue, valueB])
            }
            exclusion={tokenB}
            title={balanceTokenA ? `Available ${balanceTokenA}` : ''}
          />
        </div>
        <div className="plus-space mx-auto my-2">
          <FontAwesomeIcon size="2x" icon={faPlus}></FontAwesomeIcon>
        </div>
        <div className="card-row">
          <TokenInputGroup
            variant={!hasSufficientFundsB && 'error'}
            tokenList={tokenList}
            token={tokenB}
            value={`${tokenBValue}`}
            onValueChanged={(newValue) =>
              setValues(([valueA]) => [valueA, newValue])
            }
            exclusion={tokenA}
            title={balanceTokenB ? `Available ${balanceTokenB}` : ''}
          />
        </div>
        {hasPriceData && (
          <div className="attribution">
            Price data from{' '}
            <a
              target="_blank"
              rel="noreferrer"
              href="https://www.coingecko.com/"
            >
              CoinGecko
            </a>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <form className="pool-page row">
      {leftColumn}
      {rightColumn}
    </form>
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
          total0.plus(shareValue.userReserves0?.shiftedBy(12) || 0),
          total1.plus(shareValue.userReserves1?.shiftedBy(12) || 0),
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
        <div className="content">
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
                    className="value-0"
                    style={{
                      width: `${value0
                        .dividedBy(value0.plus(value1))
                        .multipliedBy(100)
                        .toFixed(3)}%`,
                    }}
                  ></div>
                  <div className="value-1"></div>
                </div>
              )}
            </div>
            <div className="value-text row">
              <div className="value-0 col">
                {total0.toFixed(3)} {token0.symbol}{' '}
                {value0 && <>(${value0.toFixed(2)})</>}
              </div>
              <div className="value-1 col ml-auto">
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
