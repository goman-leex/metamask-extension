import React, { useState } from 'react';
import {
  Box,
  Button,
  ButtonLink,
  ButtonLinkSize,
  ButtonSize,
  ButtonVariant,
  Checkbox,
  Icon,
  IconName,
  IconSize,
  Text,
} from '../../../../component-library';
import {
  AlignItems,
  BlockSize,
  BorderRadius,
  Display,
  TextAlign,
  TextVariant,
} from '../../../../../helpers/constants/design-system';
import { useI18nContext } from '../../../../../hooks/useI18nContext';
import useAlerts from '../../../../../hooks/useAlerts';
import { AlertModal } from '../alert-modal';
import { Alert } from '../../../../../ducks/confirm-alerts/confirm-alerts';
import { getSeverityStyle } from '../alert-modal/alert-modal';

export type ConfirmAlertModalProps = {
  /** The unique key representing the specific alert field. */
  alertKey: string;
  /** The owner ID of the relevant alert from the `confirmAlerts` reducer. */
  ownerId: string;
  /** The function to be executed when the modal needs to be closed. */
  onClose: () => void;
  /** Callback function that is called when the alert link is clicked. */
  onAlertLinkClick?: () => void;
  /** Callback function that is called when the cancel button is clicked. */
  onCancel?: () => void;
  /** Callback function that is called when the submit button is clicked. */
  onSubmit?: () => void;
};

function ConfirmButtons({
  onCancel,
  onSubmit,
  isConfirmed,
}: {
  onCancel?: () => void;
  onSubmit?: () => void;
  isConfirmed: boolean;
}) {
  const t = useI18nContext();
  return (
    <>
      <Button
        block
        onClick={onCancel}
        size={ButtonSize.Lg}
        variant={ButtonVariant.Secondary}
        data-testid="confirm-alert-modal-cancel-button"
      >
        {t('cancel')}
      </Button>
      <Button
        variant={ButtonVariant.Primary}
        onClick={onSubmit}
        size={ButtonSize.Lg}
        data-testid="confirm-alert-modal-submit-button"
        disabled={!isConfirmed}
        danger
      >
        {t('confirm')}
      </Button>
    </>
  );
}

function ConfirmDetails({
  onAlertLinkClick,
}: {
  onAlertLinkClick?: () => void;
}) {
  const t = useI18nContext();
  return (
    <>
      <Box alignItems={AlignItems.center} textAlign={TextAlign.Center}>
        <Text variant={TextVariant.bodySm}>
          {t('alertModalFrictionDetails')}
        </Text>
        <ButtonLink
          paddingTop={5}
          paddingBottom={5}
          size={ButtonLinkSize.Inherit}
          textProps={{
            variant: TextVariant.bodyMd,
            alignItems: AlignItems.flexStart,
          }}
          as="a"
          onClick={onAlertLinkClick}
          target="_blank"
          rel="noopener noreferrer"
          data-testid={'confirm-alert-modal-review-all-alerts'}
        >
          <Icon
            name={IconName.SecuritySearch}
            size={IconSize.Inherit}
            marginLeft={1}
          />
          {t('alertModalReviewAllAlerts')}
        </ButtonLink>
      </Box>
    </>
  );
}

function AcknowledgeCheckbox({
  selectedAlert,
  isConfirmed,
  setConfirmCheckbox,
}: {
  selectedAlert?: Alert;
  isConfirmed: boolean;
  setConfirmCheckbox: (value: boolean) => void;
}) {
  const t = useI18nContext();
  const severityStyle = getSeverityStyle(selectedAlert?.severity);
  return (
    <Box
      display={Display.Flex}
      padding={3}
      width={BlockSize.Full}
      gap={3}
      backgroundColor={severityStyle.background}
      marginTop={4}
      borderRadius={BorderRadius.LG}
    >
      <Checkbox
        label={t('alertModalFrictionAcknowledge')}
        data-testid="confirm-alert-modal-acknowledge-checkbox"
        isChecked={isConfirmed}
        onChange={() => setConfirmCheckbox(!isConfirmed)}
        alignItems={AlignItems.flexStart}
        className={'alert-modal__acknowledge-checkbox'}
      />
    </Box>
  );
}

export function ConfirmAlertModal({
  alertKey,
  onAlertLinkClick,
  onCancel,
  onClose,
  onSubmit,
  ownerId,
}: ConfirmAlertModalProps) {
  const t = useI18nContext();
  const { alerts } = useAlerts(ownerId);

  const selectedAlert = alerts.find((alert) => alert.key === alertKey);

  const [confirmCheckbox, setConfirmCheckbox] = useState<boolean>(false);

  return (
    <AlertModal
      ownerId={ownerId}
      onAcknowledgeClick={onClose}
      alertKey={alertKey}
      onClose={onClose}
      customAlertTitle={t('alertModalFrictionTitle')}
      customAlertDetails={
        <ConfirmDetails onAlertLinkClick={onAlertLinkClick} />
      }
      customAcknowledgeCheckbox={
        <AcknowledgeCheckbox
          selectedAlert={selectedAlert}
          isConfirmed={confirmCheckbox}
          setConfirmCheckbox={setConfirmCheckbox}
        />
      }
      customAcknowledgeButton={
        <ConfirmButtons
          onCancel={onCancel}
          onSubmit={onSubmit}
          isConfirmed={confirmCheckbox}
        />
      }
    />
  );
}
