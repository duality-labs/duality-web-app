import { useState, useMemo, FunctionComponent } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons';
import BigNumber from 'bignumber.js';

import { useFilteredTokenList, useUniqueChainName } from './hooks';
import { Token, getTokenId } from '../../lib/web3/utils/tokens';
import { useTokens } from '../../lib/web3/hooks/useDenomClients';
import {
  matchToken,
  useTokensSortedByValue,
} from '../../lib/web3/hooks/useTokens';
import { useTokenPairsDenoms } from '../../lib/web3/hooks/useTokenPairs';
import {
  useBankBalanceDisplayAmount,
  useUserBankBalancesDenoms,
} from '../../lib/web3/hooks/useUserBankBalances';

import { useSimplePrice } from '../../lib/tokenPrices';
import { formatAmount, formatCurrency } from '../../lib/utils/number';

import SelectionModal, {
  SelectionModalChild,
  SelectionModalDialogRow,
} from './SelectionModal';

import './TokenPicker.scss';

interface TokenPickerProps {
  className?: string;
  onChange?: (newToken: Token | undefined) => void;
  exclusion?: Token | undefined;
  value: Token | undefined;
  disabled?: boolean;
  showChain?: boolean;
  defaultAssetMode?: AssetMode;
  ChildComponent?: FunctionComponent<SelectionModalChild<Token>>;
}

type AssetMode = 'Your Assets' | 'Dex Assets' | 'All Assets';
export type { AssetMode as TokenPickerAssetMode };

function OpenTokenPickerButton({
  className,
  value,
  disabled,
  open,
  showChain,
}: {
  className?: string;
  value: Token | undefined;
  disabled?: boolean;
  open?: () => void;
  showChain?: boolean;
}) {
  return (
    <button
      type="button"
      className={[className, 'my-1'].filter(Boolean).join(' ')}
      onClick={open}
      disabled={disabled}
      tabIndex={open ? 0 : -1}
    >
      {value?.logo_URIs ? (
        <img
          className="token-image"
          alt={`${value.symbol} logo`}
          // in this context (large images) prefer SVGs over PNGs for better images
          src={value.logo_URIs.svg || value.logo_URIs.png}
        />
      ) : (
        <FontAwesomeIcon
          icon={faQuestionCircle}
          size="2x"
          className="token-image token-image-not-found"
        ></FontAwesomeIcon>
      )}
      <span className="token-symbol">{value?.symbol ?? 'Select A Token'}</span>
      {showChain && (
        <span className="token-chain">
          {value?.chain.pretty_name ?? value?.chain.chain_name}
        </span>
      )}
    </button>
  );
}
function OpenTokenPickerButtonWithChain(
  props: React.ComponentProps<typeof OpenTokenPickerButton>
) {
  return <OpenTokenPickerButton {...props} showChain={true} />;
}

export default function TokenPicker({
  className,
  value,
  onChange,
  exclusion,
  disabled = false,
  showChain = true,
  defaultAssetMode: givenDefaultAssetMode = 'Dex Assets',
  ChildComponent = showChain
    ? OpenTokenPickerButtonWithChain
    : OpenTokenPickerButton,
}: TokenPickerProps) {
  // source allowed denoms from several places
  const userDenoms = useUserBankBalancesDenoms();
  const dexDenoms = useTokenPairsDenoms();
  // find all tokens that may be selected in this input group
  const { data: dexTokenList = [] } = useTokens(dexDenoms);
  const { data: userTokenList = [] } = useTokens(userDenoms);

  // make an exception to the default asset mode:
  // show the user the Dex assets if they have no assets themselves
  const defaultAssetMode: AssetMode =
    givenDefaultAssetMode === 'Your Assets' && userTokenList.length === 0
      ? 'All Assets'
      : givenDefaultAssetMode;
  const [assetMode = defaultAssetMode, setAssetMode] = useState<AssetMode>();

  const [searchQuery, setSearchQuery] = useState('');

  // update the filtered list whenever the query or the list changes
  const unsortedTokenList = useMemo(() => {
    switch (assetMode) {
      case 'Your Assets':
        return userTokenList;
      case 'Dex Assets':
        // hide unrecommended not found (generated from denom) assets
        return dexTokenList.filter((token) => token.chain.chain_id);
      default:
        // compile user and dex lists into one list
        return [...userTokenList, ...dexTokenList].reduce<Token[]>(
          (tokens, token) => {
            if (!tokens.find(({ base }) => base === token.base)) {
              return [...tokens, token];
            }
            return tokens;
          },
          []
        );
    }
  }, [assetMode, dexTokenList, userTokenList]);
  const sortedTokenList = useTokensSortedByValue(unsortedTokenList);
  const filteredList = useFilteredTokenList(sortedTokenList, searchQuery);
  const valueInList = useMemo(() => {
    // ensure value exists in the values array by matching by ID
    return (value && filteredList?.find(matchToken(value))) || value;
  }, [value, filteredList]);
  const excludedValues = useMemo(() => {
    // ensure excluded values exist in the values array by matching by ID
    const foundValue = exclusion && filteredList?.find(matchToken(exclusion));
    return foundValue ? [foundValue] : [];
  }, [exclusion, filteredList]);

  return (
    <SelectionModal<Token, AssetMode>
      buttonClassName={[className, 'my-1', 'token-picker-toggle']
        .filter(Boolean)
        .join(' ')}
      bodyClassName="token-picker-body"
      values={filteredList}
      value={valueInList}
      onChange={onChange}
      excludedValues={excludedValues}
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      tabs={useMemo(() => ['Your Assets', 'Dex Assets', 'All Assets'], [])}
      tab={assetMode}
      onTabChange={setAssetMode}
      header="Select a token"
      placholder={
        assetMode === 'Your Assets' ? (
          <div>
            <p>Your wallet contains no tradable tokens</p>
            <p>Add tokens to your wallet to see them here</p>
          </div>
        ) : (
          <div>No match found</div>
        )
      }
      disabled={disabled}
      RowComponent={TokenPickerItem}
      ChildComponent={ChildComponent}
    />
  );
}

function TokenPickerItem({
  value: token,
  values,
  renderMarkedTextSections,
}: SelectionModalDialogRow<Token>) {
  const chainName = useUniqueChainName(values, token);

  const tokenId = getTokenId(token);
  const logos = token.logo_URIs;
  const { data: balance = 0 } = useBankBalanceDisplayAmount(tokenId);
  const {
    data: [price = 0],
  } = useSimplePrice(Number(balance) ? [token] : []);

  return (
    <>
      {logos ? (
        <img
          // in this context (small images) prefer PNGs over SVGs
          // for reduced number of elements to be drawn in list
          src={logos.svg || logos.png}
          alt={`${token.symbol || 'Token'} logo`}
          className="token-image"
        />
      ) : (
        <FontAwesomeIcon
          icon={faQuestionCircle}
          size="2x"
          className="token-image token-image-not-found"
        ></FontAwesomeIcon>
      )}
      <span className="token-symbol">
        <abbr title={token.description ?? token.name}>
          {renderMarkedTextSections(token.symbol)}
        </abbr>
      </span>
      <span className="chain-name">{renderMarkedTextSections(chainName)}</span>
      {new BigNumber(balance).isZero() ? (
        <span className="token-zero-balance">{formatAmount(balance)}</span>
      ) : (
        <>
          <span className="token-balance">
            {formatAmount(balance, { useGrouping: true })}
          </span>
          <span className="token-value">
            {price
              ? formatCurrency(
                  new BigNumber(price).multipliedBy(balance).toNumber()
                )
              : null}
          </span>
        </>
      )}
    </>
  );
}
