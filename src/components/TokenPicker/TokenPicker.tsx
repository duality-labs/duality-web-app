import { useTokens } from './mockHooks';

export default function TokenPicker({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (eventOrValue: string) => void;
}) {
  const { data: tokens = [] } = useTokens();
  return (
    <div className="token-picker w-60 max-w-full">
      <label className="block p-2">Select a token</label>
      <ul className="token-picker-list border-t border-slate-500 py-2">
        {tokens?.map((token) => (
          <li
            key={token}
            className={`py-1 px-2 hover:bg-slate-600 cursor-pointer${
              value === token ? ' bg-slate-700' : ''
            }`}
            onClick={() => onChange(token)}
          >
            {token}
          </li>
        ))}
      </ul>
    </div>
  );
}
