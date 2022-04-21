import { useTokens } from './mockHooks';

export default function TokenPicker() {
  const { data: tokens = [], isValidating } = useTokens();
  return (
    <div className="token-picker">
      {isValidating && <div>Loading...</div>}
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
