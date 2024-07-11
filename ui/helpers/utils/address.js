import {
  isValidHexAddress
} from '../../../shared/modules/hexstring-utils';

export function getAccountAddressErrorMessage(
  accounts,
  context,
  newAccountAddress,
) {
  let errorMessage;
  if (
    !isValidHexAddress(newAccountAddress, {
      allowNonPrefixed: false,
      mixedCaseUseChecksum: false,
    })
  ) {
    errorMessage = context.t('addressInvalidate');
  }
  const isDuplicateAccountName = accounts.some(
    (item) => item.address.toLowerCase() === newAccountAddress.toLowerCase(),
  );

  if (isDuplicateAccountName) {
    errorMessage = context.t('addressDuplicate');
  }

  return { isValidAccountAddress: !errorMessage, errorMessage };
}