import { Fragment, ReactNode } from 'react';

export default function Table<DataRow>({
  data = [],
  columns = [],
  headings = [],
}: {
  data?: DataRow[];
  columns?: Array<(row: DataRow) => ReactNode>;
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
        {data.map((row, index) => {
          return (
            <tr key={index}>
              {columns.map((column, index) => {
                const cell = column(row);
                // wrap strings in the expected element
                return (
                  <Fragment key={index}>
                    {typeof cell !== 'object' ? <td>{cell}</td> : cell}
                  </Fragment>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
