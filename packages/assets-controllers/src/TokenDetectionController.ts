import type {
  AccountsControllerGetSelectedAccountAction,
  AccountsControllerSelectedAccountChangeEvent,
} from '@metamask/accounts-controller';
import type {
  RestrictedControllerMessenger,
  ControllerGetStateAction,
  ControllerStateChangeEvent,
} from '@metamask/base-controller';
import contractMap from '@metamask/contract-metadata';
import { ChainId, safelyExecute } from '@metamask/controller-utils';
import type {
  KeyringControllerGetStateAction,
  KeyringControllerLockEvent,
  KeyringControllerUnlockEvent,
} from '@metamask/keyring-controller';
import type {
  NetworkClientId,
  NetworkControllerFindNetworkClientIdByChainIdAction,
  NetworkControllerGetNetworkConfigurationByNetworkClientId,
  NetworkControllerGetProviderConfigAction,
  NetworkControllerNetworkDidChangeEvent,
} from '@metamask/network-controller';
import { StaticIntervalPollingController } from '@metamask/polling-controller';
import type {
  PreferencesControllerGetStateAction,
  PreferencesControllerStateChangeEvent,
} from '@metamask/preferences-controller';
import type { Hex } from '@metamask/utils';

import type { AssetsContractController } from './AssetsContractController';
import { isTokenDetectionSupportedForNetwork } from './assetsUtil';
import type {
  GetTokenListState,
  TokenListStateChange,
  TokenListToken,
} from './TokenListController';
import type { Token } from './TokenRatesController';
import type {
  TokensControllerAddDetectedTokensAction,
  TokensControllerGetStateAction,
} from './TokensController';

const DEFAULT_INTERVAL = 180000;

/**
 * Compare 2 given strings and return boolean
 * eg: "foo" and "FOO" => true
 * eg: "foo" and "bar" => false
 * eg: "foo" and 123 => false
 *
 * @param value1 - first string to compare
 * @param value2 - first string to compare
 * @returns true if 2 strings are identical when they are lowercase
 */
export function isEqualCaseInsensitive(
  value1: string,
  value2: string,
): boolean {
  if (typeof value1 !== 'string' || typeof value2 !== 'string') {
    return false;
  }
  return value1.toLowerCase() === value2.toLowerCase();
}

type LegacyToken = Omit<
  Token,
  'aggregators' | 'image' | 'balanceError' | 'isERC721'
> & {
  name: string;
  logo: string;
  erc20?: boolean;
  erc721?: boolean;
};

export const STATIC_MAINNET_TOKEN_LIST = Object.entries<LegacyToken>(
  contractMap,
).reduce<
  Record<
    string,
    Partial<TokenListToken> & Pick<Token, 'address' | 'symbol' | 'decimals'>
  >
>((acc, [base, contract]) => {
  const { logo, ...tokenMetadata } = contract;
  return {
    ...acc,
    [base.toLowerCase()]: {
      ...tokenMetadata,
      address: base.toLowerCase(),
      iconUrl: `images/contract/${logo}`,
      aggregators: [],
    },
  };
}, {});

export const controllerName = 'TokenDetectionController';

export type TokenDetectionState = Record<never, never>;

export type TokenDetectionControllerGetStateAction = ControllerGetStateAction<
  typeof controllerName,
  TokenDetectionState
>;

export type TokenDetectionControllerActions =
  TokenDetectionControllerGetStateAction;

export type AllowedActions =
  | AccountsControllerGetSelectedAccountAction
  | NetworkControllerFindNetworkClientIdByChainIdAction
  | NetworkControllerGetNetworkConfigurationByNetworkClientId
  | NetworkControllerGetProviderConfigAction
  | GetTokenListState
  | KeyringControllerGetStateAction
  | PreferencesControllerGetStateAction
  | TokensControllerGetStateAction
  | TokensControllerAddDetectedTokensAction;

export type TokenDetectionControllerStateChangeEvent =
  ControllerStateChangeEvent<typeof controllerName, TokenDetectionState>;

export type TokenDetectionControllerEvents =
  TokenDetectionControllerStateChangeEvent;

export type AllowedEvents =
  | AccountsControllerSelectedAccountChangeEvent
  | NetworkControllerNetworkDidChangeEvent
  | TokenListStateChange
  | KeyringControllerLockEvent
  | KeyringControllerUnlockEvent
  | PreferencesControllerStateChangeEvent;

export type TokenDetectionControllerMessenger = RestrictedControllerMessenger<
  typeof controllerName,
  TokenDetectionControllerActions | AllowedActions,
  TokenDetectionControllerEvents | AllowedEvents,
  AllowedActions['type'],
  AllowedEvents['type']
>;

/**
 * Controller that passively polls on a set interval for Tokens auto detection
 * @property intervalId - Polling interval used to fetch new token rates
 * @property chainId - The chain ID of the current network
 * @property selectedAddress - Vault selected address
 * @property networkClientId - The network client ID of the current selected network
 * @property disabled - Boolean to track if network requests are blocked
 * @property isUnlocked - Boolean to track if the keyring state is unlocked
 * @property isDetectionEnabledFromPreferences - Boolean to track if detection is enabled from PreferencesController
 * @property isDetectionEnabledForNetwork - Boolean to track if detected is enabled for current network
 */
export class TokenDetectionController extends StaticIntervalPollingController<
  typeof controllerName,
  TokenDetectionState,
  TokenDetectionControllerMessenger
> {
  #intervalId?: ReturnType<typeof setTimeout>;

  #chainId: Hex;

  #selectedAddress: string;

  #networkClientId: NetworkClientId;

  #disabled: boolean;

  #isUnlocked: boolean;

  #isDetectionEnabledFromPreferences: boolean;

  #isDetectionEnabledForNetwork: boolean;

  readonly #getBalancesInSingleCall: AssetsContractController['getBalancesInSingleCall'];

  readonly #trackMetaMetricsEvent: (options: {
    event: string;
    category: string;
    properties: {
      tokens: string[];
      token_standard: string;
      asset_type: string;
    };
  }) => void;

  /**
   * Creates a TokenDetectionController instance.
   *
   * @param options - The controller options.
   * @param options.messenger - The controller messaging system.
   * @param options.disabled - If set to true, all network requests are blocked.
   * @param options.interval - Polling interval used to fetch new token rates
   * @param options.networkClientId - The selected network client ID of the current network
   * @param options.selectedAddress - Vault selected address
   * @param options.getBalancesInSingleCall - Gets the balances of a list of tokens for the given address.
   * @param options.trackMetaMetricsEvent - Sets options for MetaMetrics event tracking.
   */
  constructor({
    networkClientId,
    selectedAddress,
    interval = DEFAULT_INTERVAL,
    disabled = true,
    getBalancesInSingleCall,
    trackMetaMetricsEvent,
    messenger,
  }: {
    networkClientId: NetworkClientId;
    selectedAddress?: string;
    interval?: number;
    disabled?: boolean;
    getBalancesInSingleCall: AssetsContractController['getBalancesInSingleCall'];
    trackMetaMetricsEvent: (options: {
      event: string;
      category: string;
      properties: {
        tokens: string[];
        token_standard: string;
        asset_type: string;
      };
    }) => void;
    messenger: TokenDetectionControllerMessenger;
  }) {
    super({
      name: controllerName,
      messenger,
      state: {},
      metadata: {},
    });

    this.#disabled = disabled;
    this.setIntervalLength(interval);

    this.#networkClientId = networkClientId;
    this.#selectedAddress =
      selectedAddress ??
      this.messagingSystem.call('AccountsController:getSelectedAccount')
        .address;
    const { chainId } =
      this.#getCorrectChainIdAndNetworkClientId(networkClientId);
    this.#chainId = chainId;

    const { useTokenDetection: defaultUseTokenDetection } =
      this.messagingSystem.call('PreferencesController:getState');
    this.#isDetectionEnabledFromPreferences = defaultUseTokenDetection;
    this.#isDetectionEnabledForNetwork = isTokenDetectionSupportedForNetwork(
      this.#chainId,
    );

    this.#getBalancesInSingleCall = getBalancesInSingleCall;

    this.#trackMetaMetricsEvent = trackMetaMetricsEvent;

    const { isUnlocked } = this.messagingSystem.call(
      'KeyringController:getState',
    );
    this.#isUnlocked = isUnlocked;

    this.#registerEventListeners();
  }

  /**
   * Constructor helper for registering this controller's messaging system subscriptions to controller events.
   */
  #registerEventListeners() {
    this.messagingSystem.subscribe('KeyringController:unlock', async () => {
      this.#isUnlocked = true;
      await this.#restartTokenDetection();
    });

    this.messagingSystem.subscribe('KeyringController:lock', () => {
      this.#isUnlocked = false;
      this.#stopPolling();
    });

    this.messagingSystem.subscribe(
      'TokenListController:stateChange',
      async ({ tokenList }) => {
        const hasTokens = Object.keys(tokenList).length;

        if (hasTokens) {
          await this.#restartTokenDetection();
        }
      },
    );

    this.messagingSystem.subscribe(
      'PreferencesController:stateChange',
      async ({ selectedAddress: newSelectedAddress, useTokenDetection }) => {
        const isSelectedAddressChanged =
          this.#selectedAddress !== newSelectedAddress;
        const isDetectionChangedFromPreferences =
          this.#isDetectionEnabledFromPreferences !== useTokenDetection;

        this.#selectedAddress = newSelectedAddress;
        this.#isDetectionEnabledFromPreferences = useTokenDetection;

        if (
          useTokenDetection &&
          (isSelectedAddressChanged || isDetectionChangedFromPreferences)
        ) {
          await this.#restartTokenDetection({
            selectedAddress: this.#selectedAddress,
          });
        }
      },
    );

    this.messagingSystem.subscribe(
      'AccountsController:selectedAccountChange',
      async ({ address: newSelectedAddress }) => {
        const isSelectedAddressChanged =
          this.#selectedAddress !== newSelectedAddress;
        if (
          isSelectedAddressChanged &&
          this.#isDetectionEnabledFromPreferences
        ) {
          this.#selectedAddress = newSelectedAddress;
          await this.#restartTokenDetection({
            selectedAddress: this.#selectedAddress,
          });
        }
      },
    );

    this.messagingSystem.subscribe(
      'NetworkController:networkDidChange',
      async ({ selectedNetworkClientId }) => {
        const isNetworkClientIdChanged =
          this.#networkClientId !== selectedNetworkClientId;

        const { chainId: newChainId } =
          this.#getCorrectChainIdAndNetworkClientId(selectedNetworkClientId);
        this.#chainId = newChainId;
        this.#isDetectionEnabledForNetwork =
          isTokenDetectionSupportedForNetwork(newChainId);

        if (isNetworkClientIdChanged && this.#isDetectionEnabledForNetwork) {
          this.#networkClientId = selectedNetworkClientId;
          await this.#restartTokenDetection({
            networkClientId: this.#networkClientId,
          });
        }
      },
    );
  }

  /**
   * Allows controller to make active and passive polling requests
   */
  enable() {
    this.#disabled = false;
  }

  /**
   * Blocks controller from making network calls
   */
  disable() {
    this.#disabled = true;
  }

  /**
   * Internal isActive state
   *
   * @type {object}
   */
  get isActive() {
    return !this.#disabled && this.#isUnlocked;
  }

  /**
   * Start polling for detected tokens.
   */
  async start() {
    this.enable();
    await this.#startPolling();
  }

  /**
   * Stop polling for detected tokens.
   */
  stop() {
    this.disable();
    this.#stopPolling();
  }

  #stopPolling() {
    if (this.#intervalId) {
      clearInterval(this.#intervalId);
    }
  }

  /**
   * Starts a new polling interval.
   */
  async #startPolling(): Promise<void> {
    if (!this.isActive) {
      return;
    }
    this.#stopPolling();
    await this.detectTokens();
    this.#intervalId = setInterval(async () => {
      await this.detectTokens();
    }, this.getIntervalLength());
  }

  #getCorrectChainIdAndNetworkClientId(networkClientId?: NetworkClientId): {
    chainId: Hex;
    networkClientId: NetworkClientId;
  } {
    if (networkClientId) {
      const networkConfiguration = this.messagingSystem.call(
        'NetworkController:getNetworkConfigurationByNetworkClientId',
        networkClientId,
      );
      if (networkConfiguration) {
        return {
          chainId: networkConfiguration.chainId,
          networkClientId,
        };
      }
    }
    const { chainId } = this.messagingSystem.call(
      'NetworkController:getProviderConfig',
    );
    const newNetworkClientId = this.messagingSystem.call(
      'NetworkController:findNetworkClientIdByChainId',
      chainId,
    );
    return {
      chainId,
      networkClientId: newNetworkClientId,
    };
  }

  async _executePoll(
    networkClientId: string,
    options: { address: string },
  ): Promise<void> {
    if (!this.isActive) {
      return;
    }
    await this.detectTokens({
      networkClientId,
      selectedAddress: options.address,
    });
  }

  /**
   * Restart token detection polling period and call detectNewTokens
   * in case of address change or user session initialization.
   *
   * @param options - Options for restart token detection.
   * @param options.selectedAddress - the selectedAddress against which to detect for token balances
   * @param options.networkClientId - The ID of the network client to use.
   */
  async #restartTokenDetection({
    selectedAddress,
    networkClientId,
  }: { selectedAddress?: string; networkClientId?: string } = {}) {
    await this.detectTokens({
      networkClientId,
      selectedAddress,
    });
    this.setIntervalLength(DEFAULT_INTERVAL);
  }

  /**
   * For each token in the token list provided by the TokenListController, checks the token's balance for the selected account address on the active network.
   * On mainnet, if token detection is disabled in preferences, ERC20 token auto detection will be triggered for each contract address in the legacy token list from the @metamask/contract-metadata repo.
   *
   * @param options - Options for token detection.
   * @param options.networkClientId - The ID of the network client to use.
   * @param options.selectedAddress - the selectedAddress against which to detect for token balances.
   */
  async detectTokens({
    networkClientId,
    selectedAddress,
  }: {
    networkClientId?: NetworkClientId;
    selectedAddress?: string;
  } = {}): Promise<void> {
    if (!this.isActive) {
      return;
    }

    const addressAgainstWhichToDetect =
      selectedAddress ?? this.#selectedAddress;
    const {
      chainId: chainIdAgainstWhichToDetect,
      networkClientId: networkClientIdAgainstWhichToDetect,
    } = this.#getCorrectChainIdAndNetworkClientId(networkClientId);

    if (!isTokenDetectionSupportedForNetwork(chainIdAgainstWhichToDetect)) {
      return;
    }

    if (
      !this.#isDetectionEnabledFromPreferences &&
      chainIdAgainstWhichToDetect !== ChainId.mainnet
    ) {
      return;
    }
    const isTokenDetectionInactiveInMainnet =
      !this.#isDetectionEnabledFromPreferences &&
      chainIdAgainstWhichToDetect === ChainId.mainnet;
    const { tokensChainsCache } = this.messagingSystem.call(
      'TokenListController:getState',
    );
    const tokenList =
      tokensChainsCache[chainIdAgainstWhichToDetect]?.data ?? {};
    const tokenListUsed = isTokenDetectionInactiveInMainnet
      ? STATIC_MAINNET_TOKEN_LIST
      : tokenList;

    const { allTokens, allDetectedTokens, allIgnoredTokens } =
      this.messagingSystem.call('TokensController:getState');
    const [tokensAddresses, detectedTokensAddresses, ignoredTokensAddresses] = [
      allTokens,
      allDetectedTokens,
      allIgnoredTokens,
    ].map((tokens) =>
      (
        tokens[chainIdAgainstWhichToDetect]?.[addressAgainstWhichToDetect] ?? []
      ).map((value) => (typeof value === 'string' ? value : value.address)),
    );
    const tokensToDetect: string[] = [];
    for (const tokenAddress of Object.keys(tokenListUsed)) {
      if (
        [
          tokensAddresses,
          detectedTokensAddresses,
          ignoredTokensAddresses,
        ].every(
          (addresses) =>
            !addresses.find((address) =>
              isEqualCaseInsensitive(address, tokenAddress),
            ),
        )
      ) {
        tokensToDetect.push(tokenAddress);
      }
    }
    const slicesOfTokensToDetect = [];
    slicesOfTokensToDetect[0] = tokensToDetect.slice(0, 1000);
    slicesOfTokensToDetect[1] = tokensToDetect.slice(
      1000,
      tokensToDetect.length - 1,
    );
    for (const tokensSlice of slicesOfTokensToDetect) {
      if (tokensSlice.length === 0) {
        break;
      }

      await safelyExecute(async () => {
        const balances = await this.#getBalancesInSingleCall(
          addressAgainstWhichToDetect,
          tokensSlice,
          networkClientIdAgainstWhichToDetect,
        );
        const tokensWithBalance: Token[] = [];
        const eventTokensDetails: string[] = [];
        for (const nonZeroTokenAddress of Object.keys(balances)) {
          const { decimals, symbol, aggregators, iconUrl, name } =
            tokenListUsed[nonZeroTokenAddress];
          eventTokensDetails.push(`${symbol} - ${nonZeroTokenAddress}`);
          tokensWithBalance.push({
            address: nonZeroTokenAddress,
            decimals,
            symbol,
            aggregators,
            image: iconUrl,
            isERC721: false,
            name,
          });
        }
        if (tokensWithBalance.length) {
          this.#trackMetaMetricsEvent({
            event: 'Token Detected',
            category: 'Wallet',
            properties: {
              tokens: eventTokensDetails,
              token_standard: 'ERC20',
              asset_type: 'TOKEN',
            },
          });
          await this.messagingSystem.call(
            'TokensController:addDetectedTokens',
            tokensWithBalance,
            {
              selectedAddress: addressAgainstWhichToDetect,
              chainId: chainIdAgainstWhichToDetect,
            },
          );
        }
      });
    }
  }
}

export default TokenDetectionController;