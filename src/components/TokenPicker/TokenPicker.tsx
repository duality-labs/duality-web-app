import { useCallback, useState } from 'react';
import Dropdown from '../Dropdown';

interface TokenPickerProps {
  onChange: (eventOrValue: string) => void;
  exclusion: string | null | undefined;
  value: string | undefined;
  tokenList: Array<string>;
}

export default function TokenPicker({
  value,
  onChange,
  exclusion,
  tokenList,
}: TokenPickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dropdown
      renderOverlay={useCallback(
        ({ close }) => (
          <div className="token-picker" aria-label="Token selection">
            <div className="p-2">
              <div className="mr-2">Select a token</div>
            </div>
            <ul className="token-picker-list border-t border-slate-500 py-2 bg-white">
              {tokenList?.map((token) => (
                <li
                  key={token}
                  className={`py-1 px-2  cursor-pointer${
                    value === token ? ' bg-slate-700' : ''
                  }${
                    exclusion === token
                      ? ' disabled opacity-25'
                      : ' hover:bg-slate-600'
                  }`}
                  onClick={() => {
                    if (token !== exclusion) {
                      onChange(token);
                      close();
                    }
                  }}
                  onKeyPress={(e) => {
                    // accept space key press as input (like buttons)
                    if (e.key === ' ' && token !== exclusion) {
                      onChange(token);
                      close();
                    }
                  }}
                  role="menuitem"
                  tabIndex={0}
                >
                  {token}
                </li>
              ))}
            </ul>
          </div>
        ),
        [value, onChange, tokenList, exclusion]
      )}
      onStateChange={(isOpen) => setIsOpen(isOpen)}
    >
      <button
        className={
          'py-1 px-3 border border-slate-200 rounded-lg dropdown-toggle' +
          (isOpen ? ' open' : '')
        }
      >
        {value || 'Choose Token'}
      </button>
    </Dropdown>
  );
}
