import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import BlockaidPackage from '@blockaid/ppom_release/package.json';

import {
  TransactionMeta,
  TransactionType,
} from '@metamask/transaction-controller';
import {
  BlockaidResultType,
  FALSE_POSITIVE_REPORT_BASE_URL,
  SECURITY_PROVIDER_UTM_SOURCE,
} from '../../../../../shared/constants/security-provider';
import ZENDESK_URLS from '../../../../helpers/constants/zendesk-url';
import { NETWORK_TO_NAME_MAP } from '../../../../../shared/constants/network';
import { Alert } from '../../../../ducks/confirm-alerts/confirm-alerts';
import { getCurrentChainId } from '../../../../selectors';
import { useI18nContext } from '../../../../hooks/useI18nContext';
import {
  REDESIGN_TRANSACTION_TYPES,
  SIGNATURE_TRANSACTION_TYPES,
} from '../../utils';
import {
  currentConfirmationSelector,
  currentSignatureRequestSecurityResponseSelector,
} from '../../selectors';
import { SecurityAlertResponse } from '../../types/confirm';
import { normalizeProviderAlert } from './utils';

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
const zlib = require('zlib');

const SUPPORTED_TRANSACTION_TYPES = [
  ...SIGNATURE_TRANSACTION_TYPES,
  ...REDESIGN_TRANSACTION_TYPES,
];

const IGNORED_RESULT_TYPES = [
  BlockaidResultType.Benign,
  BlockaidResultType.Loading,
];

type SecurityAlertResponsesState = {
  metamask: {
    signatureSecurityAlertResponses: Record<string, SecurityAlertResponse>;
    transactions: TransactionMeta[];
  };
};

const useBlockaidAlerts = (): Alert[] => {
  const t = useI18nContext();

  const currentConfirmation = useSelector(
    currentConfirmationSelector,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) as Record<string, any>;

  const selectorChainId = useSelector(getCurrentChainId);

  const securityAlertId = currentConfirmation?.securityAlertResponse
    ?.securityAlertId as string;

  const transactionType = currentConfirmation?.type as TransactionType;

  const signatureSecurityAlertResponse = useSelector(
    currentSignatureRequestSecurityResponseSelector,
  );

  const transactionSecurityAlertResponse = useSelector(
    (state: SecurityAlertResponsesState) =>
      state.metamask.transactions.find(
        (transaction) =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (transaction.securityAlertResponse as any)?.securityAlertId ===
          securityAlertId,
      )?.securityAlertResponse,
  );

  const securityAlertResponse =
    signatureSecurityAlertResponse || transactionSecurityAlertResponse;

  const isTransactionTypeSupported =
    SUPPORTED_TRANSACTION_TYPES.includes(transactionType);

  const isResultTypeIgnored = IGNORED_RESULT_TYPES.includes(
    securityAlertResponse?.result_type as BlockaidResultType,
  );

  let jsonData: string | undefined;

  if (securityAlertResponse && currentConfirmation) {
    const {
      block,
      features,
      reason,
      result_type: resultType,
    } = securityAlertResponse;
    const { chainId, msgParams, origin, type, txParams } = currentConfirmation;

    const isFailedResultType = resultType === BlockaidResultType.Errored;

    const reportData = {
      blockNumber: block,
      blockaidVersion: BlockaidPackage.version,
      chain: (NETWORK_TO_NAME_MAP as Record<string, string>)[
        chainId ?? selectorChainId
      ],
      classification: isFailedResultType ? 'error' : reason,
      domain: origin ?? msgParams?.origin ?? origin,
      jsonRpcMethod: type,
      jsonRpcParams: JSON.stringify(txParams ?? msgParams),
      resultType: isFailedResultType ? BlockaidResultType.Errored : resultType,
      reproduce: JSON.stringify(features),
    };

    jsonData = JSON.stringify(reportData);
  }

  return useMemo<Alert[]>(() => {
    if (
      !isTransactionTypeSupported ||
      isResultTypeIgnored ||
      !securityAlertResponse
    ) {
      return [];
    }

    let reportUrl = ZENDESK_URLS.SUPPORT_URL;
    if (jsonData) {
      const encodedData = zlib?.gzipSync?.(jsonData) ?? jsonData;

      reportUrl = `${FALSE_POSITIVE_REPORT_BASE_URL}?data=${encodeURIComponent(
        encodedData.toString('base64'),
      )}&utm_source=${SECURITY_PROVIDER_UTM_SOURCE}`;
    }

    return [normalizeProviderAlert(securityAlertResponse, t, reportUrl)];
  }, [
    isTransactionTypeSupported,
    isResultTypeIgnored,
    securityAlertResponse,
    jsonData,
    t,
  ]);
};

export default useBlockaidAlerts;
