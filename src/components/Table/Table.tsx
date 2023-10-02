import { Fragment, ReactNode } from 'react';
import './Table.scss';

export default function Table<DataRow, Context = Record<string, unknown>>({
  data,
  columns = [],
  headings = [],
  context,
  rowDescription = 'Data',
  filtered = false,
}: {
  data?: DataRow[];
  columns?: Array<
    React.FunctionComponent<{
      row: DataRow;
      rows: DataRow[];
      context?: Context;
    }>
  >;
  headings?: Array<ReactNode> | (() => Array<ReactNode>);
  context?: Context;
  rowDescription?: string;
  filtered?: boolean;
}) {
  if (columns.length !== headings.length) {
    throw new Error('Expected equal number of headings and columns');
  }

  return (
    <table className="simple-table" style={{ width: '100%' }}>
      <thead>
        <tr>
          {(Array.isArray(headings) ? headings : headings()).map(
            (heading, index) => {
              // wrap strings in the expected element
              return (
                <Fragment key={index}>
                  {typeof heading !== 'object' ? <th>{heading}</th> : heading}
                </Fragment>
              );
            }
          )}
        </tr>
      </thead>
      <tbody>
        {data && data.length > 0 ? (
          data.map((row, index, rows) => {
            return (
              <tr key={index}>
                {columns.map((Column, index) => {
                  // allow component to handle setting of <td>
                  return (
                    <Column
                      key={index}
                      row={row}
                      rows={rows}
                      context={context}
                    />
                  );
                })}
              </tr>
            );
          })
        ) : (
          <tr>
            <td colSpan={columns.length}>
              {data ? (
                <>
                  No {filtered ? 'Matching' : ''} {rowDescription} Found
                </>
              ) : (
                <>Loading...</>
              )}
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
