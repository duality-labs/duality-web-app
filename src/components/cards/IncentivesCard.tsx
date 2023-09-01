import { DetailedHTMLProps, HTMLAttributes } from 'react';
import { Link, useMatch } from 'react-router-dom';
import { Gauge } from '@duality-labs/dualityjs/types/codegen/dualitylabs/duality/incentives/gauge';

import TableCard from './TableCard';

import './IncentivesCard.scss';
import useTokens, { matchTokenByAddress } from '../../lib/web3/hooks/useTokens';
import { formatAmount, formatDecimalPlaces } from '../../lib/utils/number';

export default function IncentivesCard({
  className,
  incentives = [],
}: DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement> & {
  incentives?: Gauge[];
}) {
  const isOnPortfolioPage = useMatch('/portfolio');
  const tokens = useTokens();
  return (
    <TableCard
      title="Incentives"
      subtitle={
        <>
          Bond your LPs tokens{' '}
          {isOnPortfolioPage ? (
            <>
              from the{' '}
              <Link
                className="text-secondary"
                style={{ textDecoration: 'underline' }}
                to="/portfolio"
              >
                portfolio page
              </Link>{' '}
            </>
          ) : null}
          to qualify for incentives provided by external sources.
        </>
      }
      className={['page-card incentives-card', className]
        .filter(Boolean)
        .join(' ')}
      scrolling={incentives.length > 1}
    >
      <table>
        {incentives.map((gauge, index) => {
          return (
            <tbody key={`${gauge.id}`}>
              <tr>
                <td colSpan={4}>
                  {gauge.isPerpetual ? (
                    <span>Perpetual</span>
                  ) : (
                    <span>
                      Ending{' '}
                      <time>
                        in{' '}
                        {formatDecimalPlaces(
                          Number(gauge.numEpochsPaidOver) -
                            Number(gauge.filledEpochs),
                          0,
                          {
                            useGrouping: true,
                          }
                        )}{' '}
                        Days
                      </time>
                      :
                    </span>
                  )}
                </td>
              </tr>

              {gauge.coins.map((coin) => {
                const token = tokens.find(matchTokenByAddress(coin.denom));
                return token ? (
                  <tr className="striped" key={`${index}-${coin.denom}`}>
                    <td className="row flex-centered p-3">
                      <img
                        className="token-logo token-current"
                        alt={`${token.symbol} logo`}
                        src={token.logo_URIs?.svg ?? token.logo_URIs?.png}
                      />
                    </td>
                    <td>{token.name}</td>
                    <td className="flex-centered">
                      {formatAmount(
                        Number(coin.amount) / Number(gauge.numEpochsPaidOver)
                      )}
                    </td>
                    <td>{token.symbol}</td>
                    <td>Per Day</td>
                    <td className="spacer"></td>
                  </tr>
                ) : null;
              })}
            </tbody>
          );
        })}
      </table>
    </TableCard>
  );
}
