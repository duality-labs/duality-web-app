import { useEffect, useState } from 'react';
import Chart from 'react-apexcharts';
import { ApexOptions } from 'apexcharts';

import { Token } from '../../lib/web3/utils/tokens';

const chartOptions: ApexOptions = {
  title: {
    text: '',
    align: 'left',
  },
  xaxis: {
    decimalsInFloat: 1,
    type: 'datetime',
    title: {
      text: 'Time',
    },
  },
  yaxis: {
    decimalsInFloat: 1,
    tooltip: {
      enabled: true,
    },
    title: {
      text: 'STK/TKN',
    },
  },
  theme: {
    mode: 'dark',
  },
  chart: {
    background: '#1f2b37',
  },
  plotOptions: {
    candlestick: {
      colors: {
        upward: '#31C48D',
        downward: '#F05252',
      },
      wick: {
        useFillColor: true,
      },
    },
  },
  tooltip: {
    z: {
      formatter(val) {
        return Number(val).toFixed(2);
      },
    },
  },
};

export default function OrderBookChart({
  tokenA,
  tokenB,
}: {
  tokenA?: Token;
  tokenB?: Token;
}) {
  const [chartSeries, setChartSeries] = useState<ApexAxisChartSeries>([]);
  useEffect(() => {
    const poller = {
      poll: async () => undefined,
    };
    poller.poll = async function poll() {
      let next = '';
      const liquidity = [];
      do {
        const response = await fetch(
          next
            ? `http://localhost:8000/timeseries/price/token/stake?pagination.key=${next}`
            : 'http://localhost:8000/timeseries/price/token/stake'
        );
        const { data = [], pagination = {} } = await response.json();
        // add data into current context
        liquidity.push(...data);
        // fetch again if necessary
        next = pagination['next_key'];
      } while (next);
      timeout = setTimeout(poller.poll, 25000);

      setChartSeries([
        {
          name: 'STK / TKN',
          data: liquidity.map((row) => {
            return [
              row[0] * 1000,
              row[1].map((n: number) =>
                Number(Math.pow(1.0001, n).toFixed(2))
              ) as number[],
            ] as number[];
          }),
        },
      ]);
    } as () => Promise<undefined>;

    let timeout = setTimeout(poller.poll, 0);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <div className="flex-centered">
      <Chart
        className="candlestick-chart"
        type="candlestick"
        options={chartOptions}
        series={chartSeries}
        height={400}
      />
    </div>
  );
}
