import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useMatch, useNavigate } from 'react-router-dom';
import BigNumber from 'bignumber.js';
import Long from 'long';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBolt,
  faFlag,
  faArrowRightArrowLeft,
  faSliders,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { LimitOrderType } from '@duality-labs/dualityjs/types/codegen/neutron/dex/tx';

import TokenInputGroup from '../../components/TokenInputGroup';
import {
  getTokenPathPart,
  useTokenAndDenomFromPath,
} from '../../lib/web3/hooks/useTokens';
import RadioButtonGroupInput from '../../components/RadioButtonGroupInput/RadioButtonGroupInput';
import NumberInput, {
  useNumericInputState,
} from '../../components/inputs/NumberInput';
import PriceDataDisclaimer from '../../components/PriceDataDisclaimer';

import { useWeb3 } from '../../lib/web3/useWeb3';
import { useBankBalanceDisplayAmount } from '../../lib/web3/hooks/useUserBankBalances';
import { useOrderedTokenPair } from '../../lib/web3/hooks/useTokenPairs';
import { useTokenPairTickLiquidity } from '../../lib/web3/hooks/useTickLiquidity';

import { getRouterEstimates, useRouterResult } from './hooks/useRouter';
import { useSwap } from './hooks/useSwap';

import { formatPercentage } from '../../lib/utils/number';
import {
  Token,
  getBaseDenomAmount,
  getTokenId,
} from '../../lib/web3/utils/tokens';
import { formatLongPrice } from '../../lib/utils/number';
import {
  useChainUtil,
  useChainAssetLists,
} from '../../lib/web3/hooks/useDenomsFromRegistry';
import { ChainRegistryChainUtil } from '@chain-registry/client';

import './Swap.scss';
import { AssetList } from '@chain-registry/types';
import { sha256 } from '@cosmjs/crypto';
import { useDeepCompareMemoize } from 'use-deep-compare-effect';

type CardType = 'trade' | 'settings';
type OrderType = 'market' | 'limit';

const defaultSlippage = '0.5';

export default function SwapPage() {
  return (
    <div className="container row">
      <div className="page col m-auto">
        <Swap />
      </div>
    </div>
  );
}

function Swap() {
  const { address, connectWallet } = useWeb3();

  const navigate = useNavigate();

  // change tokens to match pathname
  const match = useMatch('/swap/:tokenA/:tokenB');
  const [tokenA, denomA] = useTokenAndDenomFromPath(match?.params['tokenA']);
  const [tokenB, denomB] = useTokenAndDenomFromPath(match?.params['tokenB']);

  // don't change tokens directly:
  // change the path name which will in turn update the tokens selected
  const setTokensPath = useCallback(
    ([tokenA, tokenB]: [Token?, Token?]) => {
      if (tokenA || tokenB) {
        navigate(
          `/swap/${getTokenPathPart(tokenA)}/${getTokenPathPart(tokenB)}`
        );
      } else {
        navigate('/swap');
      }
    },
    [navigate]
  );
  const setTokenA = useCallback(
    (tokenA: Token | undefined) => {
      setTokensPath([tokenA, tokenB]);
    },
    [setTokensPath, tokenB]
  );
  const setTokenB = useCallback(
    (tokenB: Token | undefined) => {
      setTokensPath([tokenA, tokenB]);
    },
    [setTokensPath, tokenA]
  );

  // use input number values (as native HTML string values)
  const [inputValueA, setInputValueA, valueA = '0'] = useNumericInputState();
  const [inputValueB, setInputValueB, valueB = '0'] = useNumericInputState();
  const [lastUpdatedA, setLastUpdatedA] = useState(true);
  const pairRequest = {
    tokenA: getTokenId(tokenA),
    tokenB: getTokenId(tokenB),
    valueA: lastUpdatedA ? valueA : undefined,
    valueB: lastUpdatedA ? undefined : valueB,
  };
  const {
    data: routerResult,
    isValidating: isValidatingRate,
    error,
  } = useRouterResult({
    tokenA: getTokenId(tokenA),
    tokenB: getTokenId(tokenB),
    valueA: lastUpdatedA ? valueA : undefined,
    valueB: lastUpdatedA ? undefined : valueB,
  });

  const rateData = getRouterEstimates(pairRequest, routerResult);
  const [{ isValidating: isValidatingSwap }, swapRequest] = useSwap();

  const valueAConverted = lastUpdatedA ? valueA : rateData?.valueA;
  const valueBConverted = lastUpdatedA ? rateData?.valueB : valueB;

  const swapTokens = useCallback(
    function () {
      setTokensPath([tokenB, tokenA]);
      setInputValueA(valueBConverted || '');
      setInputValueB(valueAConverted || '');
      setLastUpdatedA((flag) => !flag);
    },
    [
      tokenA,
      tokenB,
      setTokensPath,
      valueAConverted,
      valueBConverted,
      setInputValueA,
      setInputValueB,
    ]
  );

  const { data: balanceTokenA } = useBankBalanceDisplayAmount(denomA);
  const valueAConvertedNumber = new BigNumber(valueAConverted || 0);
  const hasFormData =
    address && tokenA && tokenB && valueAConvertedNumber.isGreaterThan(0);
  const hasSufficientFunds =
    valueAConvertedNumber.isLessThanOrEqualTo(balanceTokenA || 0) || false;

  const [inputSlippage, setInputSlippage, slippage = '0'] =
    useNumericInputState(defaultSlippage);

  const [token0, token1] =
    useOrderedTokenPair([getTokenId(tokenA), getTokenId(tokenB)]) || [];
  const {
    data: [token0Ticks, token1Ticks],
  } = useTokenPairTickLiquidity([token0, token1]);

  const onFormSubmit = useCallback(
    function (event?: React.FormEvent<HTMLFormElement>) {
      if (event) event.preventDefault();
      // calculate tolerance from user slippage settings
      // set tiny minimum of tolerance as the frontend calculations
      // don't always exactly align with the backend calculations
      const tolerance = Math.max(1e-12, parseFloat(slippage) / 100);
      const tickIndexLimit = routerResult?.tickIndexOut?.toNumber();
      if (
        address &&
        routerResult &&
        tokenA &&
        tokenB &&
        !isNaN(tolerance) &&
        tickIndexLimit !== undefined &&
        !isNaN(tickIndexLimit)
      ) {
        // convert to swap request format
        const result = routerResult;
        // Cosmos requires tokens in integer format of smallest denomination
        // calculate gas estimate
        const tickMin =
          routerResult.tickIndexIn &&
          routerResult.tickIndexOut &&
          Math.min(
            routerResult.tickIndexIn.toNumber(),
            routerResult.tickIndexOut.toNumber()
          );
        const tickMax =
          routerResult.tickIndexIn &&
          routerResult.tickIndexOut &&
          Math.max(
            routerResult.tickIndexIn.toNumber(),
            routerResult.tickIndexOut.toNumber()
          );
        const forward = result.tokenIn === token0;
        const ticks = forward ? token1Ticks : token0Ticks;
        const ticksPassed =
          (tickMin !== undefined &&
            tickMax !== undefined &&
            ticks?.filter((tick) => {
              return (
                tick.tickIndex1To0.isGreaterThanOrEqualTo(tickMin) &&
                tick.tickIndex1To0.isLessThanOrEqualTo(tickMax)
              );
            })) ||
          [];
        const ticksUsed =
          ticksPassed?.filter(
            forward
              ? (tick) => !tick.reserve1.isZero()
              : (tick) => !tick.reserve0.isZero()
          ).length || 0;
        const ticksUnused =
          new Set<number>([
            ...(ticksPassed?.map((tick) => tick.tickIndex1To0.toNumber()) ||
              []),
          ]).size - ticksUsed;
        const gasEstimate = ticksUsed
          ? // 120000 base
            120000 +
            // add 80000 if multiple ticks need to be traversed
            (ticksUsed > 1 ? 80000 : 0) +
            // add 1000000 for each tick that we need to remove liquidity from
            1000000 * (ticksUsed - 1) +
            // add 500000 for each tick we pass without drawing liquidity from
            500000 * ticksUnused +
            // add another 500000 for each reverse tick we pass without drawing liquidity from
            (forward ? 0 : 500000 * ticksUnused)
          : 0;

        swapRequest(
          {
            amount_in: getBaseDenomAmount(tokenA, result.amountIn) || '0',
            token_in: result.tokenIn,
            token_out: result.tokenOut,
            creator: address,
            receiver: address,
            // see LimitOrderType in types repo (cannot import at runtime)
            // using type FILL_OR_KILL so that partially filled requests fail
            order_type: 1 as LimitOrderType.FILL_OR_KILL,
            // todo: set tickIndex to allow for a tolerance:
            //   the below function is a tolerance of 0
            tick_index_in_to_out: Long.fromNumber(
              tickIndexLimit * (forward ? 1 : -1)
            ),
            max_amount_out: getBaseDenomAmount(tokenB, result.amountOut) || '0',
          },
          gasEstimate
        );
      }
    },
    [
      address,
      routerResult,
      tokenA,
      tokenB,
      token0,
      token0Ticks,
      token1Ticks,
      slippage,
      swapRequest,
    ]
  );

  const onValueAChanged = useCallback(
    (newInputValue = '') => {
      setInputValueA(newInputValue);
      setLastUpdatedA(true);
    },
    [setInputValueA]
  );
  const onValueBChanged = useCallback(
    (newInputValue = '') => {
      setInputValueB(newInputValue);
      setLastUpdatedA(false);
    },
    [setInputValueB]
  );

  const [cardType, setCardType] = useState<CardType>('trade');
  const [orderType, setOrderType] = useState<OrderType>('market');
  const [rateTokenOrderAuto, setRateTokenOrderAuto] =
    useState<[Token, Token]>();
  const [rateTokenOrderManual, setRateTokenOrderManual] =
    useState<[Token, Token]>();
  const rateTokenOrder = rateTokenOrderManual || rateTokenOrderAuto;

  const toggleRateTokenOrderManual = useCallback(() => {
    setRateTokenOrderManual(
      (tokens) =>
        (tokens || rateTokenOrderAuto)?.slice().reverse() as [Token, Token]
    );
  }, [rateTokenOrderAuto]);

  const chainUtil = useChainUtil();
  useEffect(() => {
    function getTrace({
      base_denom,
      path,
    }: {
      path: string;
      base_denom: string;
    }) {
      const denom = `${path}/${base_denom}`;
      return (
        'ibc/' +
        Buffer.from(sha256(Buffer.from(denom)))
          .toString('hex')
          .toUpperCase()
      );
    }
    if (chainUtil) {
      const denomTraceIBCs = denomTraces.map(({ base_denom, path }) => {
        const denom = `${path}/${base_denom}`;
        return (
          'ibc/' +
          Buffer.from(sha256(Buffer.from(denom)))
            .toString('hex')
            .toUpperCase()
        );
      });
      console.log('denomTraceIBCs', denomTraceIBCs.length);

      const allBaseDenoms = (chainUtil?.chainInfo.assetLists as AssetList[])
        ?.at(0)
        ?.assets.map((a) => a.base);
      console.log('allBaseDenoms', allBaseDenoms);

      // console.log('matched denoms', denomTraceIBCs.filter(denom => allBaseDenoms?.includes(denom)))
      // console.log('unmatched denoms', denomTraceIBCs.filter(denom => !allBaseDenoms?.includes(denom)))

      console.log(
        'matched denomTraces',
        denomTraces
          .filter((denom) => allBaseDenoms?.includes(getTrace(denom)))
          .sort((a, b) => a.path.localeCompare(b.path))
      );
      console.log(
        'unmatched denomTraces',
        denomTraces
          .filter((denom) => !allBaseDenoms?.includes(getTrace(denom)))
          .sort((a, b) => a.path.localeCompare(b.path))
      );

      // console.log(
      //   'chainUtil getAssetByDenom',
      //   chainUtil?.chainInfo.assetLists
      //   // chainUtil?.getAssetByDenom(
      //   //   'ibc/26139E488F510BDA8DDE5614D358A38502BDA061954B8D10ADEFC4EAA58552FF'
      //   // )
      // );
    }
  }, [chainUtil]);

  const chainAssetLists = useChainAssetLists();
  useEffect(() => {
    console.log('chainAssetLists', chainAssetLists);
  }, [chainAssetLists]);

  // set the token order for the rate
  useEffect(() => {
    if (tokenA && tokenB) {
      // console.log('tokenA', tokenA);
      // place B as stable denominator
      if (!isStablecoin(tokenA) && isStablecoin(tokenB)) {
        setRateTokenOrderAuto([tokenA, tokenB]);
      }
      // place in order of swap trade
      else {
        setRateTokenOrderAuto([tokenB, tokenA]);
      }
    }
    function isStablecoin(token: Token) {
      return token.description?.toLowerCase().includes('stablecoin');
    }
  }, [tokenA, tokenB]);

  // if tokens change then reset the manual order setting
  useEffect(() => {
    if (tokenA && tokenB) {
      setRateTokenOrderManual((tokenOrder) => {
        // keep settings if tokens have not changed
        if (tokenOrder?.every((token) => [tokenA, tokenB].includes(token))) {
          return tokenOrder;
        }
        // remove settings if they have
        return undefined;
      });
    }
  }, [tokenA, tokenB]);

  const priceImpact =
    routerResult &&
    routerResult.priceBToAIn?.isGreaterThan(0) &&
    routerResult.priceBToAOut?.isGreaterThan(0)
      ? new BigNumber(
          new BigNumber(routerResult.priceBToAIn).dividedBy(
            new BigNumber(routerResult.priceBToAOut)
          )
        ).minus(1)
      : undefined;

  const tradeCard = (
    <div className="trade-card">
      <div className="page-card">
        <div className="row mb-3">
          <h3 className="h3 card-title">Swap</h3>
          <button
            className="icon-button ml-auto"
            type="button"
            onClick={() => setCardType('settings')}
          >
            <FontAwesomeIcon icon={faSliders}></FontAwesomeIcon>
          </button>
        </div>
        <div className="card-row order-type mb-4">
          <RadioButtonGroupInput<OrderType>
            className="order-type-input mb-4 hide"
            values={useMemo(
              () => ({
                market: (
                  <>
                    <FontAwesomeIcon
                      className="mr-3"
                      icon={faBolt}
                    ></FontAwesomeIcon>
                    Market Order
                  </>
                ),
                limit: (
                  <>
                    <FontAwesomeIcon
                      className="mr-3"
                      icon={faFlag}
                    ></FontAwesomeIcon>
                    Limit Order
                  </>
                ),
              }),
              []
            )}
            value={orderType}
            onChange={setOrderType}
          />
        </div>
        <div className="card-row">
          <TokenInputGroup
            variant={
              (!hasSufficientFunds || error?.insufficientLiquidityIn) && 'error'
            }
            onValueChanged={onValueAChanged}
            onTokenChanged={setTokenA}
            token={tokenA}
            denom={denomA}
            value={lastUpdatedA ? inputValueA : valueAConverted}
            className={
              isValidatingRate && !lastUpdatedA
                ? valueAConverted
                  ? 'estimated-rate'
                  : 'loading-token'
                : ''
            }
            exclusion={tokenB}
          ></TokenInputGroup>
        </div>
        <div className="card-row my-3">
          <button
            type="button"
            onClick={swapTokens}
            className="icon-button swap-button"
          >
            <FontAwesomeIcon
              icon={faArrowRightArrowLeft}
              rotation={90}
            ></FontAwesomeIcon>
          </button>
        </div>
        <div className="card-row">
          <TokenInputGroup
            variant={error?.insufficientLiquidityOut && 'error'}
            onValueChanged={onValueBChanged}
            onTokenChanged={setTokenB}
            token={tokenB}
            denom={denomB}
            value={lastUpdatedA ? valueBConverted : inputValueB}
            className={
              isValidatingRate && lastUpdatedA
                ? valueBConverted
                  ? 'estimated-rate'
                  : 'loading-token'
                : ''
            }
            exclusion={tokenA}
            disabledInput={true}
          ></TokenInputGroup>
        </div>
        <div className="card-row text-detail">
          {tokenA &&
            tokenB &&
            parseFloat(valueAConverted || '') > 0 &&
            parseFloat(valueBConverted || '') > 0 && (
              <div className="text-grid my-4">
                <span className="text-header">Exchange Rate</span>
                <span className="text-value">
                  {routerResult && rateTokenOrder ? (
                    <>
                      1 {rateTokenOrder[1].symbol} ={' '}
                      {formatLongPrice(
                        routerResult.tokenIn === getTokenId(rateTokenOrder[1])
                          ? routerResult.amountOut
                              .dividedBy(routerResult.amountIn)
                              .toFixed()
                          : routerResult.amountIn
                              .dividedBy(routerResult.amountOut)
                              .toFixed()
                      )}{' '}
                      {rateTokenOrder[0].symbol}
                      <button
                        className="icon-button ml-3"
                        type="button"
                        onClick={toggleRateTokenOrderManual}
                      >
                        <FontAwesomeIcon
                          icon={faArrowRightArrowLeft}
                        ></FontAwesomeIcon>
                      </button>
                    </>
                  ) : isValidatingRate ? (
                    'Finding exchange rate...'
                  ) : (
                    'No exchange information'
                  )}
                </span>
                <span className="text-header">Price Impact</span>
                {priceImpact && (
                  <span
                    className={[
                      'text-value',
                      (() => {
                        switch (true) {
                          case priceImpact.isGreaterThanOrEqualTo(0):
                            return 'text-success';
                          case priceImpact.isGreaterThan(-0.01):
                            return 'text-value';
                          case priceImpact.isGreaterThan(-0.05):
                            return 'text';
                          default:
                            return 'text-error';
                        }
                      })(),
                    ].join(' ')}
                  >
                    {formatPercentage(priceImpact.toFixed(), {
                      maximumSignificantDigits: 4,
                      minimumSignificantDigits: 4,
                    })}
                  </span>
                )}
              </div>
            )}
        </div>
        <div className="mt-4">
          {address ? (
            hasFormData &&
            hasSufficientFunds &&
            !error?.insufficientLiquidity &&
            !error?.insufficientLiquidityIn &&
            !error?.insufficientLiquidityOut ? (
              <button
                className="submit-button button-primary"
                type="submit"
                disabled={!new BigNumber(valueBConverted || 0).isGreaterThan(0)}
              >
                {orderType === 'limit' ? 'Place Limit Order' : 'Swap'}
              </button>
            ) : error?.insufficientLiquidity ? (
              <button className="submit-button button-error" type="button">
                Insufficient liquidity
              </button>
            ) : hasFormData ? (
              <button className="submit-button button-error" type="button">
                Insufficient funds
              </button>
            ) : (
              <button
                className="submit-button button-ghost"
                type="button"
                disabled
              >
                Enter Asset Amount
              </button>
            )
          ) : (
            <button
              className="submit-button button-dark"
              type="button"
              onClick={connectWallet}
            >
              Connect Wallet
            </button>
          )}
        </div>
        <PriceDataDisclaimer tokenA={tokenA} tokenB={tokenB} />
      </div>
      <SettingsCard
        cardType={cardType}
        setCardType={setCardType}
        inputSlippage={inputSlippage}
        setInputSlippage={setInputSlippage}
      />
    </div>
  );
  return (
    <form
      onSubmit={onFormSubmit}
      className={['swap-page page-card p-0 row', isValidatingSwap && 'disabled']
        .filter(Boolean)
        .join(' ')}
    >
      {tradeCard}
    </form>
  );
}

function SettingsCard({
  cardType,
  setCardType,
  inputSlippage,
  setInputSlippage,
}: {
  cardType: CardType;
  setCardType: React.Dispatch<React.SetStateAction<CardType>>;
  inputSlippage: string;
  setInputSlippage: React.Dispatch<React.SetStateAction<string>>;
}) {
  const [denomtrace, stepDenomTrace] = useDenomTraceIteration();
  return (
    <div
      className={[
        'settings-card',
        `settings-card--${cardType === 'settings' ? 'visible' : 'hidden'}`,
      ].join(' ')}
    >
      <div className="page-card">
        <div className="row mb-4">
          <h3 className="h3 card-title">Settings</h3>
          <button
            className="icon-button ml-auto"
            type="button"
            onClick={() => setCardType('trade')}
          >
            <FontAwesomeIcon icon={faXmark}></FontAwesomeIcon>
          </button>
        </div>
        <div className="row mb-3">
          <h4 className="card-title">Max Slippage</h4>
          <NumberInput
            type="text"
            className="ml-auto"
            value={inputSlippage}
            appendString="%"
            onChange={setInputSlippage}
          />
          <button
            type="button"
            className="badge badge-lg badge-info ml-2"
            onClick={() => setInputSlippage(defaultSlippage)}
          >
            Auto
          </button>
        </div>
        <div>
          <div className="row gap-2">
            <button
              type="button"
              className="button button-warning"
              onClick={() => stepDenomTrace(-1)}
            >
              prev
            </button>
            <button
              type="button"
              className="button button-warning"
              onClick={() => stepDenomTrace(1)}
            >
              next
            </button>
            <button
              type="button"
              className="button button-warning"
              onClick={() => stepDenomTrace(10)}
            >
              jump 10
            </button>
          </div>
          <div>
            index {denomTraces.indexOf(denomtrace)}/{denomTraces.length}
            <DenomInfo
              path={denomtrace.path}
              baseDenom={denomtrace.base_denom}
            />
          </div>
          <div>{JSON.stringify(denomtrace)}</div>
        </div>
      </div>
    </div>
  );
}

// define default options to start exploring without fetching too much data
const defaultChainUtilOptions = {
  chainNames: ['neutrontestnet'],
  selectedAssestListNames: ['neutrontestnet'],
};

function DenomInfo({ path, baseDenom }: { path: string; baseDenom: string }) {
  const transferChannels: Array<[portId: string, channelId: string]> =
    useDeepCompareMemoize(
      path
        .split('/')
        .flatMap((path, index, paths) =>
          index % 2 !== 0 ? [[paths[index - 1], path]] : []
        )
    );
  // const [transferChainNames, setTransferChainNames] = useState([
  //   'neutrontestnet',
  // ]);
  // const chainUtils = useChainUtil(transferChainNames);

  const [{ chainNames, selectedAssestListNames }, setChainUtilOpts] = useState<{
    chainNames: string[];
    selectedAssestListNames: string[];
  }>(defaultChainUtilOptions);
  const chainUtil = useChainUtil(chainNames, selectedAssestListNames);

  useEffect(() => console.log('changed chainNames', chainNames), [chainNames]);
  useEffect(
    () =>
      console.log('changed selectedAssestListNames', selectedAssestListNames),
    [selectedAssestListNames]
  );
  useEffect(() => console.log('changed chainUtil', chainUtil), [chainUtil]);

  useEffect(() => {
    // reset the chain names
    setChainUtilOpts(defaultChainUtilOptions);
  }, [path]);

  const ibcHash = Buffer.from(sha256(Buffer.from(`${path}/${baseDenom}`)))
    .toString('hex')
    .toUpperCase();
  const ibcDenom = useMemo(() => {
    try {
      return chainUtil?.getAssetByDenom('ibc/' + ibcHash);
    } catch (e) {
      console.log('why does this throw?', e);
    }
  }, [chainUtil, ibcHash]);

  // make chain util fetch deeper
  useEffect(() => {
    const lastChainName = chainNames.at(-1);
    const ibcData = chainUtil?.chainInfo.fetcher.getChainIbcData(
      lastChainName || ''
    );
    const nextTransferChannelIndex = chainNames.length - 1;
    const nextTransferChannel = transferChannels.at(nextTransferChannelIndex);
    console.log('will fetch more IBC data? for', lastChainName, {
      ibcDenom: !ibcDenom,
      ibcData: !!ibcData,
      lastChainName: !!lastChainName,
      nextTransferChannel: !!nextTransferChannel,
      chainUtil: !!chainUtil,
    });

    function setNextChainName(chainName: string) {
      setChainUtilOpts(({ chainNames }) => {
        // if this would be the last step then find the assetlist of this chain
        // otherwise we should keep searching IBC data
        if (chainNames.length >= transferChannels.length) {
          return {
            chainNames,
            selectedAssestListNames: [chainName],
          };
        } else {
          return {
            chainNames: [...chainNames, chainName],
            selectedAssestListNames: [],
          };
        }
      });
    }
    // if we don't have all the transfer channel hops covered then fetch more IBC data
    if (!ibcDenom && ibcData && lastChainName && nextTransferChannel) {
      console.log('will fetch more IBC data', ibcData);
      const [portId, channelId] = nextTransferChannel;
      for (const ibcDataRow of ibcData) {
        // look up chain 1
        if (ibcDataRow.chain_1.chain_name === lastChainName) {
          const foundChannel = ibcDataRow.channels.find((channel) => {
            return (
              channel.chain_1.channel_id === channelId &&
              channel.chain_1.port_id === portId
            );
          });
          if (foundChannel) {
            console.log('found channel in ', ibcDataRow, {
              lastChainName,
              nextTransferChannel,
            });
            setNextChainName(ibcDataRow.chain_2.chain_name);
            break;
          }
        }
        // look up chain 2
        else if (ibcDataRow.chain_2.chain_name === lastChainName) {
          const foundChannel = ibcDataRow.channels.find((channel) => {
            return (
              channel.chain_2.channel_id === channelId &&
              channel.chain_2.port_id === portId
            );
          });
          if (foundChannel) {
            console.log('found channel in ', ibcDataRow, {
              lastChainName,
              nextTransferChannel,
            });
            setNextChainName(ibcDataRow.chain_1.chain_name);
            break;
          }
        }
      }
      console.log('could not find channel in', ibcData, {
        lastChainName,
        nextTransferChannel,
      });
      // } else if () {
      //   console.log('will fetch more asset data', ibcData, ibcDenom);
      //   console.log('transferChainNames', chainNames);
      //   console.log('transferChannels', transferChannels);
    } else {
      console.log('will not fetch more IBC data', ibcData, ibcDenom);

      // const lastChainName = chainNames.at(-1);
      // const ibcData = chainUtil?.chainInfo.fetcher.getChainIbcData(
      //   lastChainName || ''
      // );
      // const nextTransferChannelIndex = chainNames.length - 1;
      // const nextTransferChannel = transferChannels.at(nextTransferChannelIndex);
      console.log('nextTransferChannel', nextTransferChannel);
      console.log('nextTransferChannel', nextTransferChannel);

      console.log('transferChainNames', chainNames);
      console.log('transferChannels', transferChannels);
    }
  }, [ibcDenom, chainNames, chainUtil, transferChannels]);

  return (
    <div>
      <div>
        Denom:{' '}
        {'ibc/' +
          Buffer.from(sha256(Buffer.from(`${path}/${baseDenom}`)))
            .toString('hex')
            .toUpperCase()}
      </div>
      <div>
        {path}/{baseDenom}
      </div>
      <div>{transferChannels.join(' - ')}</div>
      <i>{JSON.stringify(ibcDenom)}</i>
      {/* {chainUtil?.chainInfo.fetcher.getChainIbcData()} */}
    </div>
  );
}

function useDenomTraceIteration(): [
  {
    path: string;
    base_denom: string;
  },
  (step: number) => void
] {
  const [traceIndex, setTraceIndex] = useState(0);

  const selectedTrace = denomTraces[traceIndex];
  const stepIndex = useCallback(
    (step: number) =>
      setTraceIndex((index) => {
        return (index + step) % denomTraces.length;
      }),
    []
  );

  return [selectedTrace, stepIndex];
}

const denomTraces = [
  { path: 'transfer/channel-1', base_denom: 'uatom' },
  { path: 'transfer/channel-133', base_denom: 'unois' },
  { path: 'transfer/channel-15', base_denom: 'umars' },
  {
    path: 'transfer/channel-151',
    base_denom: 'cosmosvaloper1x357jc0vvtnhr2an86r46a0ekqtk74jk4cd73h/1',
  },
  { path: 'transfer/channel-160', base_denom: 'utia' },
  { path: 'transfer/channel-168', base_denom: 'uatom' },
  { path: 'transfer/channel-174', base_denom: 'uosmo' },
  { path: 'transfer/channel-186', base_denom: 'uosmo' },
  { path: 'transfer/channel-196', base_denom: 'uosmo' },
  { path: 'transfer/channel-204', base_denom: 'utia' },
  { path: 'transfer/channel-208', base_denom: 'unls' },
  { path: 'transfer/channel-209', base_denom: 'unls' },
  { path: 'transfer/channel-21', base_denom: 'uosmo' },
  { path: 'transfer/channel-221', base_denom: 'utia' },
  { path: 'transfer/channel-23', base_denom: 'umars' },
  { path: 'transfer/channel-239', base_denom: 'uatom' },
  { path: 'transfer/channel-24', base_denom: 'uosmo' },
  { path: 'transfer/channel-28', base_denom: 'uosmo' },
  {
    path: 'transfer/channel-3',
    base_denom:
      'cw20:terra167dsqkh2alurx997wmycw9ydkyu54gyswe3ygmrs4lwume3vmwks8ruqnv',
  },
  { path: 'transfer/channel-369', base_denom: 'uatom' },
  { path: 'transfer/channel-8', base_denom: 'eth-wei' },
  { path: 'transfer/channel-8', base_denom: 'uausdc' },
  { path: 'transfer/channel-8', base_denom: 'uaxl' },
  { path: 'transfer/channel-8', base_denom: 'wsteth-wei' },
  { path: 'transfer/channel-94', base_denom: 'umars' },
  { path: 'transfer/channel-96', base_denom: 'uatom' },
  { path: 'transfer/channel-97/transfer/channel-16', base_denom: 'untrn' },
  { path: 'transfer/channel-97', base_denom: 'umars' },
  { path: 'transfer/channel-98', base_denom: 'uluna' },
].sort((a, b) => getPathLength(a) - getPathLength(b));

function getPathLength({
  path,
  base_denom,
}: {
  path: string;
  base_denom: string;
}) {
  return path.split('/').length / 2;
}
