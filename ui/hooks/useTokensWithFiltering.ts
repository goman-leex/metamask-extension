import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { isEqual } from 'lodash';
import { ChainId } from '@metamask/controller-utils';
import { Hex } from '@metamask/utils';
import {
  getAllTokens,
  getCurrentCurrency,
  getSelectedInternalAccount,
  getShouldHideZeroBalanceTokens,
  getTokenExchangeRates,
} from '../selectors';
import { getConversionRate } from '../ducks/metamask/metamask';
import {
  SwapsTokenObject,
  TokenBucketPriority,
} from '../../shared/constants/swaps';
import { useTokenTracker } from './useTokenTracker';
import { getRenderableTokenData } from './useTokensToSearch';

const MAX_UNOWNED_TOKENS_RENDERED = 30;
/*
Sorts tokenList by query match, balance/popularity, all other tokens
*/
export const useTokensWithFiltering = <T extends SwapsTokenObject>(
  searchQuery: string,
  tokenList: Record<string, T>,
  topTokens: { address: string }[],
  chainId: ChainId | Hex = '0x',
  sortOrder: TokenBucketPriority = TokenBucketPriority.owned,
  maxItems: number = MAX_UNOWNED_TOKENS_RENDERED,
) => {
  const allDetectedTokens = useSelector(getAllTokens);
  const { address: selectedAddress } = useSelector(getSelectedInternalAccount);

  const allDetectedTokensForChainAndAddress =
    allDetectedTokens?.[chainId]?.[selectedAddress] ?? [];

  const shouldHideZeroBalanceTokens = useSelector(
    getShouldHideZeroBalanceTokens,
  );
  const { tokensWithBalances }: { tokensWithBalances: T[] } = useTokenTracker({
    tokens: allDetectedTokensForChainAndAddress,
    address: selectedAddress,
    hideZeroBalanceTokens: Boolean(shouldHideZeroBalanceTokens),
  });

  const tokenConversionRates = useSelector(getTokenExchangeRates, isEqual);
  const conversionRate = useSelector(getConversionRate);
  const currentCurrency = useSelector(getCurrentCurrency);

  const filteredTokenList = useMemo(() => {
    if (!topTokens || !tokenList) {
      return [];
    }
    const filteredTokens: T[] = [];
    const filteredTokensAddresses = new Set<string | undefined>();

    function* tokenGenerator() {
      if (sortOrder === TokenBucketPriority.owned) {
        for (const token of tokensWithBalances) {
          if (
            tokenList?.[token.address] ??
            tokenList?.[token.address.toLowerCase()]
          ) {
            yield token;
          }
        }
      }

      for (const { address } of topTokens) {
        const token =
          tokenList?.[address] ?? tokenList?.[address.toLowerCase()];
        if (token) {
          yield token;
        }
      }

      for (const token of Object.values(tokenList)) {
        yield token;
      }
    }

    let token: T;
    for (token of tokenGenerator()) {
      if (
        token.symbol?.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !filteredTokensAddresses.has(token.address?.toLowerCase())
      ) {
        filteredTokensAddresses.add(token.address?.toLowerCase());
        filteredTokens.push(
          getRenderableTokenData(
            token.address
              ? {
                  ...token,
                  ...(tokenList[token.address] ??
                    tokenList[token.address.toLowerCase()]),
                }
              : token,
            tokenConversionRates,
            conversionRate,
            currentCurrency,
            chainId,
            tokenList,
          ),
        );
      }

      if (filteredTokens.length >= maxItems) {
        break;
      }
    }

    return filteredTokens;
  }, [
    topTokens,
    searchQuery,
    tokenConversionRates,
    conversionRate,
    currentCurrency,
    chainId,
    tokenList,
  ]);

  return filteredTokenList;
};
