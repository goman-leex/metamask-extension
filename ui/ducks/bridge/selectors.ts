import { createSelector } from 'reselect';
import { NetworkState, ProviderConfig } from '@metamask/network-controller';
import { getProviderConfig } from '../metamask/metamask';
import {
  getAllNetworks,
  getIsBridgeEnabled,
  getSwapsDefaultToken,
} from '../../selectors';
import { BridgeState } from './bridge';
import * as swapsSlice from '../swaps/swaps';

import { ALLOWED_BRIDGE_CHAIN_IDS } from '../../../shared/constants/bridge';
import {
  BridgeControllerState,
  BridgeFeatureFlagsKey,
} from '../../../app/scripts/controllers/bridge';
import {
  FEATURED_RPCS,
  RPCDefinition,
} from '../../../shared/constants/network';
import { uniqBy } from 'lodash';

// TODO add swaps state
type BridgeAppState = {
  metamask: NetworkState & { bridgeState: BridgeControllerState } & {
    useExternalServices: boolean;
  };
  bridge: BridgeState;
};

export const getFromChain = (state: BridgeAppState): ProviderConfig =>
  getProviderConfig(state);
export const getToChain = (state: BridgeAppState): ProviderConfig =>
  state.bridge.toChain;

export const getAllBridgeableNetworks = (
  state: BridgeAppState,
): (ProviderConfig | RPCDefinition)[] => {
  const allNetworks = getAllNetworks(state); // includes networks user has added
  return uniqBy([...allNetworks, ...FEATURED_RPCS], 'chainId').filter(
    ({ chainId }) => ALLOWED_BRIDGE_CHAIN_IDS.includes(chainId),
  );
};
export const getFromChains = createSelector(
  getAllBridgeableNetworks,
  (state: BridgeAppState) => state.metamask.bridgeState?.bridgeFeatureFlags,
  getToChain,
  (
    allBridgeableNetworks,
    bridgeFeatureFlags,
    toChain,
  ): (ProviderConfig | RPCDefinition)[] =>
    allBridgeableNetworks.filter(
      ({ chainId }) =>
        chainId !== toChain?.chainId &&
        bridgeFeatureFlags[
          BridgeFeatureFlagsKey.NETWORK_SRC_ALLOWLIST
        ].includes(chainId),
    ),
);
export const getToChains = createSelector(
  getAllBridgeableNetworks,
  (state: BridgeAppState) => state.metamask.bridgeState?.bridgeFeatureFlags,
  getFromChain,
  (
    allBridgeableNetworks,
    bridgeFeatureFlags,
    fromChain,
  ): (ProviderConfig | RPCDefinition)[] =>
    allBridgeableNetworks.filter(
      ({ chainId }) =>
        chainId !== fromChain.chainId &&
        bridgeFeatureFlags[
          BridgeFeatureFlagsKey.NETWORK_DEST_ALLOWLIST
        ].includes(chainId),
    ),
);

export const getFromToken = (state: BridgeAppState) => {
  const swapsFromToken = swapsSlice.getFromToken(state);
  if (!swapsFromToken?.address) {
    return getSwapsDefaultToken(state);
  }
  return swapsFromToken;
};
export const getToToken = (state: BridgeAppState) => {
  return swapsSlice.getToToken(state);
};

export const getFromAmount = (state: BridgeAppState) =>
  swapsSlice.getFromTokenInputValue(state);
export const getToAmount = () => {
  return '0';
};

export const getIsBridgeTx = createSelector(
  getFromChain,
  getToChain,
  (state: BridgeAppState) => getIsBridgeEnabled(state),
  (fromChain, toChain, isBridgeEnabled: boolean) =>
    isBridgeEnabled &&
    toChain !== null &&
    fromChain.chainId !== toChain.chainId,
);
