// eslint-disable-next-line import/no-named-as-default
import Router from 'react-router-dom';

import { AbstractMessage } from '@metamask/message-manager';
import { ApprovalRequest } from '@metamask/approval-controller';
import {
  TransactionMeta,
  TransactionStatus,
  TransactionType,
} from '@metamask/transaction-controller';
import { Hex, Json } from '@metamask/utils';
import { ApprovalType } from '@metamask/controller-utils';
import { renderHookWithProvider } from '../../../../test/lib/render-helpers';
import mockState from '../../../../test/data/mock-state.json';
import useCurrentConfirmation from './useCurrentConfirmation';

const ID_MOCK = '123-456';
const ID_2_MOCK = '456-789';

const MESSAGE_MOCK = {
  id: ID_MOCK,
  msgParams: {
    data: 'test',
  },
};

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
}));

const APPROVAL_MOCK = {
  id: ID_MOCK,
  type: ApprovalType.EthSignTypedData,
};

const TRANSACTION_MOCK = {
  id: ID_MOCK,
  chainId: mockState.metamask.providerConfig.chainId as Hex,
  status: TransactionStatus.unapproved,
  type: TransactionType.contractInteraction,
};

function arrayToIdMap<T>(array: T[]): Record<string, T> {
  return array.reduce(
    (acc, item) => ({
      ...acc,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      [(item as any).id]: item,
    }),
    {},
  );
}

function buildState({
  message,
  pendingApprovals,
  redesignedConfirmationsEnabled,
  transaction,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  message?: Partial<AbstractMessage & { msgParams: any }>;
  pendingApprovals?: Partial<ApprovalRequest<Record<string, Json>>>[];
  redesignedConfirmationsEnabled?: boolean;
  transaction?: Partial<TransactionMeta>;
}) {
  return {
    ...mockState,
    metamask: {
      ...mockState.metamask,
      pendingApprovals: pendingApprovals ? arrayToIdMap(pendingApprovals) : {},
      preferences: {
        redesignedConfirmationsEnabled,
      },
      transactions: transaction ? [transaction] : [],
      unapprovedPersonalMsgs: message
        ? { [message.id as string]: message }
        : {},
    },
  };
}

function runHook(state: Parameters<typeof buildState>[0]) {
  const response = renderHookWithProvider(
    useCurrentConfirmation,
    buildState(state),
  );

  return response.result.current.currentConfirmation;
}

function mockParamId(id: string) {
  jest.spyOn(Router, 'useParams').mockReturnValue({ id });
}

describe('useCurrentConfirmation', () => {
  it('return message matching latest pending approval ID', () => {
    const currentConfirmation = runHook({
      message: MESSAGE_MOCK,
      pendingApprovals: [APPROVAL_MOCK],
      redesignedConfirmationsEnabled: true,
    });

    expect(currentConfirmation).toStrictEqual(MESSAGE_MOCK);
  });

  it('return transaction matching latest pending approval ID', () => {
    const currentConfirmation = runHook({
      pendingApprovals: [{ ...APPROVAL_MOCK, type: ApprovalType.Transaction }],
      redesignedConfirmationsEnabled: true,
      transaction: TRANSACTION_MOCK,
    });

    expect(currentConfirmation).toStrictEqual(TRANSACTION_MOCK);
  });

  it('returns message matching ID param', () => {
    mockParamId(ID_MOCK);

    const currentConfirmation = runHook({
      message: MESSAGE_MOCK,
      pendingApprovals: [
        { ...APPROVAL_MOCK, time: 0 },
        { ...APPROVAL_MOCK, time: 1, id: ID_2_MOCK },
      ],
      redesignedConfirmationsEnabled: true,
    });

    expect(currentConfirmation).toStrictEqual(MESSAGE_MOCK);
  });

  it('returns transaction matching ID param', () => {
    mockParamId(ID_MOCK);

    const currentConfirmation = runHook({
      pendingApprovals: [
        { ...APPROVAL_MOCK, time: 0 },
        { ...APPROVAL_MOCK, time: 1, id: ID_2_MOCK },
      ],
      redesignedConfirmationsEnabled: true,
      transaction: TRANSACTION_MOCK,
    });

    expect(currentConfirmation).toStrictEqual(TRANSACTION_MOCK);
  });

  it('returns undefined if redesign preference disabled', () => {
    const currentConfirmation = runHook({
      message: MESSAGE_MOCK,
      pendingApprovals: [APPROVAL_MOCK],
      redesignedConfirmationsEnabled: false,
    });

    expect(currentConfirmation).toBeUndefined();
  });

  it('returns undefined if approval for message has incorrect type', () => {
    const currentConfirmation = runHook({
      message: MESSAGE_MOCK,
      pendingApprovals: [{ ...APPROVAL_MOCK, type: ApprovalType.EthSign }],
      redesignedConfirmationsEnabled: true,
    });

    expect(currentConfirmation).toBeUndefined();
  });

  it('returns undefined if transaction has incorrect type', () => {
    const currentConfirmation = runHook({
      pendingApprovals: [{ ...APPROVAL_MOCK, type: ApprovalType.Transaction }],
      redesignedConfirmationsEnabled: true,
      transaction: { ...TRANSACTION_MOCK, type: TransactionType.cancel },
    });

    expect(currentConfirmation).toBeUndefined();
  });

  it('returns undefined if transaction has incorrect chain ID', () => {
    const currentConfirmation = runHook({
      pendingApprovals: [{ ...APPROVAL_MOCK, type: ApprovalType.Transaction }],
      redesignedConfirmationsEnabled: true,
      transaction: { ...TRANSACTION_MOCK, chainId: '0x123' },
    });

    expect(currentConfirmation).toBeUndefined();
  });

  it('returns undefined if transaction is not unapproved', () => {
    const currentConfirmation = runHook({
      pendingApprovals: [{ ...APPROVAL_MOCK, type: ApprovalType.Transaction }],
      redesignedConfirmationsEnabled: true,
      transaction: { ...TRANSACTION_MOCK, status: TransactionStatus.submitted },
    });

    expect(currentConfirmation).toBeUndefined();
  });

  it('returns undefined if message is SIWE', () => {
    const currentConfirmation = runHook({
      message: {
        ...MESSAGE_MOCK,
        msgParams: { siwe: { isSIWEMessage: true } },
      },
      pendingApprovals: [{ ...APPROVAL_MOCK, type: ApprovalType.PersonalSign }],
      redesignedConfirmationsEnabled: true,
    });

    expect(currentConfirmation).toBeUndefined();
  });
});
