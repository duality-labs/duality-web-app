import { Fragment, ReactNode } from 'react';

export default function Table<DataRow>({
  data = [],
  columns = [],
  headings = [],
}: {
  data?: DataRow[];
  columns?: Array<React.FunctionComponent<{ row: DataRow; rows: DataRow[] }>>;
  headings?: Array<ReactNode> | (() => Array<ReactNode>);
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
        {data.map((row, index, rows) => {
          return (
            <tr key={index}>
              {columns.map((Column, index) => {
                // allow component to handle setting of <td>
                return <Column key={index} row={row} rows={rows} />;
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
