import { ReactNode } from 'react';

export default function Table<DataRow extends Record<string, unknown>>({
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
        {(Array.isArray(headings) ? headings : headings()).map((heading) => {
          // wrap strings in the expected element
          return typeof heading !== 'function' ? <th>{heading}</th> : heading;
        })}
      </thead>
      <tbody>
        {data.map((row) => {
          return columns.map((column) => {
            const cell = column(row);
            // wrap strings in the expected element
            return typeof cell !== 'function' ? <td>{cell}</td> : cell;
          });
        })}
      </tbody>
    </table>
  );
}
