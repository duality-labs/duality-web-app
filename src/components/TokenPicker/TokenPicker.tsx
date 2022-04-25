import { useCallback } from 'react';
import Dropdown from '../Dropdown';

import { useTokens } from './mockHooks';

export default function TokenPicker({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (eventOrValue: string) => void;
}) {
  const { data: tokens = [], isValidating } = useTokens();
  return (
    <Dropdown
      renderOverlay={useCallback(
        ({ close }) => (
          <div className="token-picker" aria-label="Token selection">
            <div className="p-2">
              <div className="mr-2">Select a token</div>
              {isValidating && <span className="opacity-25">loading...</span>}
            </div>
            <ul className="token-picker-list border-t border-slate-500 py-2">
              {tokens?.map((token) => (
                <li
                  key={token}
                  className={`py-1 px-2 hover:bg-slate-600 cursor-pointer${
                    value === token ? ' bg-slate-700' : ''
                  }`}
                  onClick={() => {
                    onChange(token);
                    close();
                  }}
                >
                  {token}
                </li>
              ))}
            </ul>
          </div>
        ),
        [tokens, isValidating, value, onChange]
      )}
    >
      <button className="py-1 px-3 border border-slate-200 rounded-lg">
        {value ?? 'Choose Token'}
      </button>
    </Dropdown>
  );
}
