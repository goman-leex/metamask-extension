import MockAccountKeyring from '../../app/scripts/lib/mock-keyring/mock-keyring';
import { HardwareKeyringType } from './hardware-wallets';

/**
 * These are the keyrings that are managed entirely by MetaMask.
 */
export enum InternalKeyringType {
  hdKeyTree = 'HD Key Tree',
  imported = 'Simple Key Pair',
}

/**
 * These are the keyrings that are managed entirely by MetaMask.
 */
export enum MockKeyringType {
  mock = 'Mock Keyring'
}

///: BEGIN:ONLY_INCLUDE_IF(keyring-snaps)
export enum SnapKeyringType {
  snap = 'Snap Keyring',
}
///: END:ONLY_INCLUDE_IF

/**
 * All keyrings supported by MetaMask.
 */
export const KeyringType = {
  ...HardwareKeyringType,
  ...InternalKeyringType,
  ...MockKeyringType,
  ///: BEGIN:ONLY_INCLUDE_IF(keyring-snaps)
  ...SnapKeyringType,
  ///: END:ONLY_INCLUDE_IF
};
