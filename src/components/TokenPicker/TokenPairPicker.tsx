import { useCallback, useState, useMemo, FunctionComponent } from 'react';

import { useFilteredPairsList } from './hooks';
import { Token } from '../../lib/web3/utils/tokens';
import { matchTokens } from '../../lib/web3/hooks/useTokens';
import useTokenPairs, {
  useValuedTokenPairs,
} from '../../lib/web3/hooks/useTokenPairs';
import { formatCurrency } from '../../lib/utils/number';

import TokenPairInput from '../inputs/TokenPairInput';
import SelectionModal, {
  SelectionModalChild,
  SelectionModalDialogRow,
} from './SelectionModal';
import { useUserValuedPairs } from '../../lib/web3/hooks/useUserPairs';
import {
  useEstimatedUserReserves,
  useValuedUserReserves,
} from '../../lib/web3/hooks/useUserReserves';

import './TokenPairPicker.scss';

type TokenPair = [tokenA: Token | undefined, tokenB: Token | undefined];
type AssetMode = 'Your Pools' | 'Dex Pools';
export type { AssetMode as TokenPairPickerAssetMode };

interface TokenPickerProps {
  className?: string;
  onChange: (tokens: TokenPair) => void;
  value: TokenPair | undefined;
  disabled?: boolean;
  showChain?: boolean;
  defaultAssetMode?: AssetMode;
  ChildComponent?: FunctionComponent<SelectionModalChild<TokenPair>>;
}

function OpenTokenPairPickerButton({
  className,
  value,
  disabled,
  open,
}: {
  className?: string;
  value: TokenPair | undefined;
  disabled?: boolean;
  open: () => void;
}) {
  const [tokenA, tokenB] = value || [];
  return (
    <TokenPairInput
      className={className}
      tokenA={tokenA}
      tokenB={tokenB}
      onClick={open}
      disabled={disabled}
    />
  );
}

interface CommonTokenPair {
  token0: Token;
  token1: Token;
  value: number;
}

export default function TokenPairPicker({
  className,
  value,
  onChange,
  disabled = false,
  defaultAssetMode: givenDefaultAssetMode = 'Dex Pools',
  ChildComponent = OpenTokenPairPickerButton,
}: TokenPickerProps) {
  // source user pairs
  const { data: userReserves } = useEstimatedUserReserves();
  const { data: userValuedReserves } = useValuedUserReserves(userReserves);
  const { data: userValuedPairs } = useUserValuedPairs(userValuedReserves);
  // source dex pairs
  const { data: dexPairs } = useTokenPairs();
  const { data: dexValuedPairs } = useValuedTokenPairs(dexPairs);

  // make an exception to the default asset mode:
  // show the user the Dex assets if they have no assets themselves
  const defaultAssetMode: AssetMode =
    givenDefaultAssetMode === 'Your Pools' && (userReserves || []).length > 0
      ? 'Your Pools'
      : 'Dex Pools';
  const [assetMode = defaultAssetMode, setAssetMode] = useState<AssetMode>();

  const [searchQuery, setSearchQuery] = useState('');

  // update the filtered list whenever the query or the list changes
  const tokenPairList = useMemo(() => {
    switch (assetMode) {
      case 'Your Pools':
        return userValuedPairs?.filter(filterToKnownTokens);
      case 'Dex Pools':
        return dexValuedPairs?.filter(filterToKnownTokens);
    }
    // hide unrecommended not found (generated from denom) assets
    function filterToKnownTokens(pair: { token0: Token; token1: Token }) {
      return pair.token0.chain.chain_id && pair.token1.chain.chain_id;
    }
  }, [assetMode, dexValuedPairs, userValuedPairs]);
  const filteredList = useFilteredPairsList<CommonTokenPair>(
    tokenPairList,
    searchQuery
  );
  const valueInList = useMemo(() => {
    // ensure value exists in the values array by matching by ID
    const [token0, token1] = value || [];
    if (token0 && token1) {
      // note switching from "token in list" to default "token" causes the
      // child component to re-render due to unequivalent token values
      // todo: change Token displays to require only `denom` prop not `token`
      return (
        filteredList?.find(
          (pair) =>
            matchTokens(pair.token0, token0) && matchTokens(pair.token1, token1)
        ) || {
          token0,
          token1,
          value: 0,
        }
      );
    }
  }, [value, filteredList]);
  const excludedValues = useMemo(() => {
    return valueInList ? [valueInList] : [];
  }, [valueInList]);

  const onModalChange = useCallback(
    (pair: CommonTokenPair | undefined) => {
      onChange([pair?.token0, pair?.token1]);
    },
    [onChange]
  );

  const ModalChildComponent = useMemo(() => {
    return function ModalChildComponent({
      value: pair,
      open,
    }: SelectionModalChild<CommonTokenPair>) {
      return (
        <ChildComponent value={[pair?.token0, pair?.token1]} open={open} />
      );
    };
  }, [ChildComponent]);

  return (
    <SelectionModal<CommonTokenPair, AssetMode>
      buttonClassName={[className, 'my-1', 'token-pair-picker-toggle']
        .filter(Boolean)
        .join(' ')}
      bodyClassName="token-pair-picker-body"
      values={filteredList}
      value={valueInList}
      onChange={onModalChange}
      excludedValues={excludedValues}
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      tabs={useMemo(() => ['Your Pools', 'Dex Pools'], [])}
      tabsNote={assetMode === 'Your Pools' ? 'Your value' : 'TVL'}
      tab={assetMode}
      onTabChange={setAssetMode}
      header="Select a Pool"
      placholder={
        assetMode === 'Your Pools' ? (
          <div>
            <p>Your wallet contains no tradable tokens</p>
            <p>Add tokens to your wallet to see them here</p>
          </div>
        ) : (
          <div>No match found</div>
        )
      }
      disabled={disabled}
      RowComponent={TokenPairPickerItem}
      ChildComponent={ModalChildComponent}
    />
  );
}

function TokenPairPickerItem({
  value: { token0, token1, value },
  renderMarkedTextSections,
}: SelectionModalDialogRow<CommonTokenPair>) {
  return (
    <>
      <TokenPairInput
        tokenA={token0}
        tokenB={token1}
        renderText={renderMarkedTextSections}
      />
      <span className="token-pair-value">{formatCurrency(value)}</span>
    </>
  );
}
