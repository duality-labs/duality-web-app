import { useTokens } from './mockHooks';

export default function TokenPicker() {
  const { data: tokens = [] } = useTokens();
  return (
    <div className="token-picker">
      {tokens.length > 0 && (
        <ul>
          {tokens.map((token) => {
            return <li key={token}>{token}</li>;
          })}
        </ul>
      )}
    </div>
  );
}
