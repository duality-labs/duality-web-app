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
import { useEditLiquidity } from './useEditLiquidity';
import { getAmountInDenom } from '../../lib/web3/utils/tokens';

const { REACT_APP__MAX_FRACTION_DIGITS = '' } = process.env;
const maxFractionDigits = parseInt(REACT_APP__MAX_FRACTION_DIGITS) || 20;

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
interface EditedTickShareValue extends TickShareValue {
  tickDiff0: BigNumber;
  tickDiff1: BigNumber;
}
interface TickShareValueMap {
  [pairID: string]: Array<TickShareValue>;
}

const defaultTokenAmount = '0';

// modify ticks only if difference is greater than our tolerance
const normalizationTolerance = Math.pow(10, -maxFractionDigits);

function matchTokenDenom(denom: string) {
  return (token: Token) =>
    !!token.denom_units.find((unit) => unit.denom === denom);
}

export default function MyLiquidity() {
  const { wallet, address } = useWeb3();
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

  const { data: allUserTokenPrices } = useSimplePrice(
    selectedTokens || allUserTokensList
  );
  // destructure common prices if selectedTokens was used
  const [price0, price1] = allUserTokenPrices;

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
  if (selectedTokens) {
    const [token0, token1] = selectedTokens;

    // get always up to date share data
    const shareValues =
      shareValueMap?.[`${token0.address}-${token1.address}`] || [];

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
      <div className="my-liquidity-detail-page">
        <div className="banner">
          <div className="heading row">
            <div className="token-symbols col py-5">
              <h1>
                {token0.symbol} + {token1.symbol}
              </h1>
              {value0 && value1 && (
                <div className="balance row mt-4">
                  <div className="col">Balance</div>
                  <div className="col ml-auto">
                    ${value0.plus(value1).toFixed(2)}
                  </div>
                </div>
              )}
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
                <div className="value-0 col mr-5">
                  {total0.toFixed(3)} {token0.symbol}{' '}
                  {value0 && <>(${value0.toFixed(2)})</>}
                </div>
                <div className="value-1 col ml-auto">
                  {total1.toFixed(3)} {token1.symbol}{' '}
                  {value1 && <>(${value1.toFixed(2)})</>}
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
      const token = allUserTokensList[tokenIndex];
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
            <div className="col font-console">{address}</div>
            <div className="col ml-auto font-console">Duality</div>
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

// set as constant to avoid unwanted hook effects
const rangeMin = '';
const rangeMax = '';
const setRangeMin = () => undefined;
const setRangeMax = () => undefined;

type EditingType = 'redistribute' | 'add' | 'remove';
const submitButtonSettings: Record<
  EditingType,
  { text: string; variant: 'primary' | 'error' | 'warning' }
> = {
  add: { text: 'Add Liquidity', variant: 'primary' },
  remove: { text: 'Remove Liquidity', variant: 'error' },
  redistribute: { text: 'Redistribute Liquidity', variant: 'warning' },
};

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

  const totalShareValues = useMemo(() => {
    return shares.reduce<[BigNumber, BigNumber]>(
      ([total0, total1], shareValue) => {
        return [
          total0.plus(shareValue.userReserves0 || 0),
          total1.plus(shareValue.userReserves1 || 0),
        ];
      },
      [new BigNumber(0), new BigNumber(0)]
    );
  }, [shares]);

  const { data: { ticks: unorderedTicks } = {} } = useIndexerPairData(
    token0?.address,
    token1?.address
  );

  const currentPriceFromTicks = useCurrentPriceFromTicks(
    token0.address,
    token1.address
  );

  const [invertedTokenOrder, setInvertedTokenOrder] = useState<boolean>(() => {
    return currentPriceFromTicks?.isLessThan(1) ?? false;
  });
  const swapAll = useCallback(() => {
    setInvertedTokenOrder((order) => !order);
  }, []);
  const tokenA = invertedTokenOrder ? token1 : token0;
  const tokenB = invertedTokenOrder ? token0 : token1;

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

  const [feeTier, setFeeTier] = useState<number>();

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

  // reset when switching between modes
  // there is a lot going on, best to just remove the state
  useEffect(() => {
    setValues(['0', '0']);
    if (editingType !== 'redistribute') {
      setEditedUserTicks(userTicks);
    }
  }, [editingType, userTicks]);

  useLayoutEffect(() => {
    setEditedUserTicks(() => {
      const [diffAValue, diffBValue] = getTickDiffCumulativeValues(
        userTicks,
        userTicks,
        values,
        editingType
      );

      // constrain the diff values to the users available shares
      const [totalAShareValue, totalBShareValue] = totalShareValues;
      const cappedDiffAValue = totalAShareValue.isLessThan(diffAValue)
        ? totalAShareValue
        : diffAValue;
      const cappedDiffBValue = totalBShareValue.isLessThan(diffBValue)
        ? totalBShareValue
        : diffBValue;

      // allow the new update to be conditionally adjusted
      let newUpdate;

      // modify only if difference is greater than our tolerance
      if (
        // if diff A is significant
        cappedDiffAValue?.absoluteValue().isGreaterThan(normalizationTolerance)
      ) {
        newUpdate = applyDiffToIndex(
          newUpdate || userTicks,
          userTicks,
          cappedDiffAValue,
          1,
          -1,
          editingType === 'add'
        );
      }
      if (
        // if diff B is significant
        cappedDiffBValue?.absoluteValue().isGreaterThan(normalizationTolerance)
      ) {
        newUpdate = applyDiffToIndex(
          newUpdate || userTicks,
          userTicks,
          cappedDiffBValue,
          2,
          -1,
          editingType === 'add'
        );
      }

      // default to no update if no normalization occurred
      return newUpdate || userTicks;
    });
  }, [values, userTicks, totalShareValues, editingType]);

  const leftColumn = (
    <div className="col">
      <LiquidityDistribution
        chartTypeSelected="AMM"
        tokenA={tokenA}
        tokenB={tokenB}
        ticks={ticks}
        feeTier={feeTier}
        setFeeTier={setFeeTier}
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
              const oldUserTick = userTicks?.[indexSelected];
              // bail if no current selection
              if (
                !newEditedUserTick ||
                !currentEditedUserTick ||
                !oldUserTick
              ) {
                return currentEditedUserTicks;
              }

              // find how much correction needs to be applied to meet the current goal
              const [diffAValue, diffBValue] = getTickDiffCumulativeValues(
                newEditedUserTicks,
                userTicks,
                values,
                editingType
              );

              // allow the new update to be conditionally adjusted
              let newUpdate;

              // modify only if difference is greater than our tolerance
              if (
                // if diff A is significant
                diffAValue
                  ?.absoluteValue()
                  .isGreaterThan(normalizationTolerance) &&
                // if value isn't trying to go negative
                !(
                  newEditedUserTick[1].isNegative() &&
                  currentEditedUserTick[1].isZero()
                )
              ) {
                newUpdate = applyDiffToIndex(
                  newUpdate || newEditedUserTicks,
                  userTicks,
                  diffAValue,
                  1,
                  indexSelected,
                  editingType === 'add'
                );
              }
              if (
                // if diff B is significant
                diffBValue
                  ?.absoluteValue()
                  .isGreaterThan(normalizationTolerance) &&
                // if value isn't trying to go negative
                !(
                  newEditedUserTick[2].isNegative() &&
                  currentEditedUserTick[2].isZero()
                )
              ) {
                newUpdate = applyDiffToIndex(
                  newUpdate || newEditedUserTicks,
                  userTicks,
                  diffBValue,
                  2,
                  indexSelected,
                  editingType === 'add'
                );
              }

              // default to no update if no normalization occurred
              return newUpdate || currentEditedUserTicks;
            });
          },
          [editingType, values, userTicks]
        )}
        rangeMin={rangeMin}
        rangeMax={rangeMax}
        setRangeMin={setRangeMin}
        setRangeMax={setRangeMax}
        swapAll={swapAll}
        canMoveUp
        canMoveDown
        viewOnlyUserTicks
        submitButtonText={submitButtonSettings[editingType].text}
        submitButtonVariant={submitButtonSettings[editingType].variant}
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
            disabledToken
            disabledInput={editingType === 'redistribute'}
            variant={!hasSufficientFundsA && 'error'}
            tokenList={tokenList}
            maxValue={
              editingType === 'remove'
                ? // use share token total or default to wallet balance
                  totalShareValues[0].toNumber()
                : balanceTokenA?.toNumber()
            }
            token={tokenA}
            value={`${tokenAValue}`}
            onValueChanged={(newValue) =>
              setValues(([_, valueB]) => [newValue, valueB])
            }
            exclusion={tokenB}
          />
        </div>
        <div className="plus-space mx-auto my-2">
          <FontAwesomeIcon size="2x" icon={faPlus}></FontAwesomeIcon>
        </div>
        <div className="card-row">
          <TokenInputGroup
            disabledToken
            disabledInput={editingType === 'redistribute'}
            variant={!hasSufficientFundsB && 'error'}
            tokenList={tokenList}
            maxValue={
              editingType === 'remove'
                ? // use share token total or default to wallet balance
                  totalShareValues[1].toNumber()
                : balanceTokenB?.toNumber()
            }
            token={tokenB}
            value={`${tokenBValue}`}
            onValueChanged={(newValue) =>
              setValues(([valueA]) => [valueA, newValue])
            }
            exclusion={tokenA}
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

  const [{ isValidating }, sendEditRequest] = useEditLiquidity();

  const onSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      // get relevant tick diffs
      const tickDiffs = getTickDiffs(editedUserTicks, userTicks);
      const sharesDiff: Array<EditedTickShareValue> = tickDiffs
        .map((tickDiff, index) => {
          const share = shares[index];
          return {
            ...share,
            // // realign tickDiff A/B back to original shares 0/1 order
            tickDiff0: invertedTokenOrder ? tickDiff[2] : tickDiff[1],
            tickDiff1: invertedTokenOrder ? tickDiff[1] : tickDiff[2],
          };
        })
        .filter(
          (share) => !share.tickDiff0.isZero() || !share.tickDiff1.isZero()
        );

      await sendEditRequest(sharesDiff);
    },
    [shares, invertedTokenOrder, editedUserTicks, userTicks, sendEditRequest]
  );

  return (
    <form
      className={['pool-page row', isValidating && 'disabled']
        .filter(Boolean)
        .join(' ')}
      onSubmit={onSubmit}
    >
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

function getTickDiffs(newTicks: TickGroup, oldTicks: TickGroup) {
  return oldTicks
    .map<Tick | undefined>((userTick, index) => {
      const editedUserTick = newTicks[index];
      // diff ticks
      if (editedUserTick && editedUserTick !== userTick) {
        // find diff
        const diffAValue = editedUserTick[1].minus(userTick[1]);
        const diffBValue = editedUserTick[2].minus(userTick[2]);
        return [userTick[0], diffAValue, diffBValue] as Tick;
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
  editingType: 'redistribute' | 'add' | 'remove'
) {
  const [tokenAValueString, tokenBValueString] = tokenValueStrings;
  const tokenAValue =
    editingType !== 'redistribute'
      ? new BigNumber(
          editingType === 'remove' ? `-${tokenAValueString}` : tokenAValueString
        )
      : new BigNumber(0);
  const tokenBValue =
    editingType !== 'redistribute'
      ? new BigNumber(
          editingType === 'remove' ? `-${tokenBValueString}` : tokenBValueString
        )
      : new BigNumber(0);

  return getTickDiffs(newTicks, oldTicks).reduce(
    ([diffAValue, diffBValue], diffTick) => {
      return [diffAValue.plus(diffTick[1]), diffBValue.plus(diffTick[2])];
    },
    [new BigNumber(0).minus(tokenAValue), new BigNumber(0).minus(tokenBValue)]
  );
}

function applyDiffToIndex(
  newTicks: TickGroup,
  oldTicks: TickGroup,
  diffCorrectionValue: BigNumber,
  tickPartIndex: number,
  tickIndexSelected: number,
  oldTickIsFloor = false
): TickGroup {
  const [adjustedUserTicks, remainder] = newTicks
    // add index onto the TickGroup making it [price, tokenAValue, tokenBValue, index]
    // to be able to track which tick is which, the result must be in the correct order
    .map((tick, index) => tick.concat(new BigNumber(index)))
    // sort descending order (but with selected index at start, it will absorb the remainder)
    .sort((a, b) => {
      const aIsSelected = a[3].isEqualTo(tickIndexSelected);
      const bIsSelected = b[3].isEqualTo(tickIndexSelected);
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
        // set the floor to be non-selected 'add' ticks or zero
        const floor =
          oldTickIsFloor && tickIndexSelected !== tick[3].toNumber()
            ? oldTicks[tick[3].toNumber()]?.[tickPartIndex]
            : new BigNumber(0);
        // skip token ticks stuck to zero
        if (tokenValue.isEqualTo(0)) {
          return [result.concat([tick]), remainder];
        }
        // divided by remainder of ticks that aren't selected
        // which would be `index + 1` but it is `index + 1 - 1`
        // because we sorted the selectedTick to be in index 0.
        // when at index 0, the selected tick, attempt to take all the remainder
        const adjustment = remainder
          .negated()
          .dividedBy(index + 1 - (tickIndexSelected >= 0 ? 1 : 0) || 1);
        const newValue = tokenValue.plus(adjustment);
        const oldTick = oldTicks[tick[3].toNumber()];
        const oldValue = oldTick[tickPartIndex];
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
          const newTick = tick.slice() as Tick;
          newTick.splice(tickPartIndex, 1, oldValue);
          return [result.concat([newTick]), remainder.plus(adjustment)];
        }
        // apply partial adjustment value using all liquidity of current tick
        if (newValue.isLessThan(floor)) {
          // insert new value (floor) into tick
          const newTick = tick.slice() as Tick;
          const [removedValue] = newTick.splice(tickPartIndex, 1, floor);
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
          return [result.concat([newTick]), remainder.plus(adjustment)];
        }
      },
      [[] as BigNumber[][], diffCorrectionValue]
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
