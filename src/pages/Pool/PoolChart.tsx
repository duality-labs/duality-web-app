import BigNumber from 'bignumber.js';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import BarChart from '../../components/charts/BarChart';
import ButtonGroup from '../../components/ButtonGroup/ButtonGroup';

import { Token, getAmountInDenom } from '../../lib/web3/utils/tokens';
import { formatCurrency } from '../../lib/utils/number';
import { useSimplePrice } from '../../lib/tokenPrices';

import './PoolChart.scss';

const { REACT_APP__INDEXER_API = '' } = process.env;

const resolutions = ['hour', 'day', 'week'] as const;

const timePeriodKeys: TimePeriodKey[] = ['24H', '1W', '1M', '1Y', 'ALL'];

type TimePeriodKey = '24H' | '1W' | '1M' | '1Y' | 'ALL';

interface DataRow {
  timestamp: string;
  tokenA: number;
  tokenB: number;
}
interface DataPeriod {
  resolution: typeof resolutions[number];
  data: Array<DataRow>;
}
interface DataPeriodsResponse {
  '24H': DataPeriod;
  '1W': DataPeriod;
  '1M': DataPeriod;
  '1Y': DataPeriod;
  ALL: DataPeriod;
}

const chartKeys = ['TVL', 'Volume', 'Fees', 'Volatility'];

export default function PoolChart({
  tokenA,
  tokenB,
}: {
  tokenA: Token;
  tokenB: Token;
}) {
  const [chartIndex, setChartIndex] = useState<number>(0);
  const [timePeriodIndex, setTimePeriodIndex] = useState<number>(0);

  const {
    data: [tokenAPrice, tokenBPrice],
  } = useSimplePrice([tokenA, tokenB]);

  const { data, isFetching } = useQuery({
    queryKey: [tokenA.address, tokenB.address],
    queryFn: async (): Promise<DataPeriodsResponse> => {
      const response = await fetch(
        `${REACT_APP__INDEXER_API}/timeseries/volume/${tokenA.address}/${tokenB.address}`
      );
      return await response.json();
    },
  });

  const dataPeriod = useMemo<DataPeriod | null>(() => {
    const timePeriodKey = timePeriodKeys[timePeriodIndex];
    if (data && timePeriodKey) {
      return data[timePeriodKey];
    }
    return null;
  }, [data, timePeriodIndex]);

  // map data to chart
  const chartData = useMemo(() => {
    const timePeriodKey = timePeriodKeys[timePeriodIndex];
    if (dataPeriod) {
      const length = (() => {
        switch (true) {
          case dataPeriod.resolution === 'hour' && timePeriodKey === '24H':
            return 24;
          case dataPeriod.resolution === 'hour' && timePeriodKey === '1W':
            return 24 * 7;
          case dataPeriod.resolution === 'day' && timePeriodKey === '1M':
            return 28;
          case dataPeriod.resolution === 'week' && timePeriodKey === '1Y':
            return 52;
          case dataPeriod.resolution === 'hour':
            return 24;
          case dataPeriod.resolution === 'day':
            return 28;
          case dataPeriod.resolution === 'week':
            return 52;
          default:
            return 1;
        }
      })();
      return Array.from({ length })
        .map((_, index) => {
          const dataRow = dataPeriod.data[index];
          // todo: find data for expected timestamps
          if (dataRow) {
            const { timestamp, tokenA, tokenB }: DataRow = dataRow;
            return { x: timestamp, y: tokenA + tokenB };
          }
          return { x: `empty-${index}`, y: 0 };
        })
        .reverse();
    }
  }, [dataPeriod, timePeriodIndex]);

  const [lastChartData] = dataPeriod?.data ?? [];

  return (
    <div className="pool-chart-area bar-chart-area">
      <div className="bar-chart__nav flex row">
        <div className="bar-chart__nav-left row gap-5">
          {chartKeys.map((chartKey, index) => {
            return (
              <button
                key={index}
                className={['pb-4 px-0', index === chartIndex && 'active']
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => setChartIndex(index)}
              >
                {chartKey}
              </button>
            );
          })}
        </div>
        <div className="bar-chart__nav-right ml-auto">
          <ButtonGroup
            buttonGroup={timePeriodKeys}
            tabIndex={timePeriodIndex}
            setTabIndex={setTimePeriodIndex}
          />
        </div>
      </div>
      {chartData && lastChartData ? (
        // plot chart
        <div className="bar-chart">
          <div className="bar-chart__header mt-lg">
            {tokenAPrice && tokenBPrice
              ? formatCurrency(
                  BigNumber.sum(
                    getAmountInDenom(
                      tokenA,
                      lastChartData.tokenA * tokenAPrice,
                      tokenA.base,
                      tokenA.display
                    ) || 0,
                    getAmountInDenom(
                      tokenB,
                      lastChartData.tokenB * tokenBPrice,
                      tokenB.base,
                      tokenB.display
                    ) || 0
                  ).toFixed()
                )
              : '...'}
          </div>
          <div className="bar-chart__subheader">
            {lastChartData ? (
              new Date(lastChartData.timestamp).toLocaleDateString(undefined, {
                dateStyle: 'long',
              })
            ) : (
              <>&nbsp;</>
            )}
          </div>
          <BarChart width={500} height={300} data={chartData} />
        </div>
      ) : (
        // show skeleton
        <div
          className="bar-chart--empty mt-6 mb-xl flex flex-centered row"
          style={{ height: 300 }}
        >
          {isFetching ? 'loading...' : 'no data'}
        </div>
      )}
    </div>
  );
}
