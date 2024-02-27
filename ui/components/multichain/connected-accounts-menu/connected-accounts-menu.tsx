import React, { useRef, useCallback } from 'react';
import {
  PopoverRole,
  PopoverPosition,
  Popover,
  IconName,
  Text,
  ModalFocus,
  Box,
} from '../../component-library';
import { MenuItem } from '../../ui/menu';
import {
  IconColor,
  TextColor,
  TextVariant,
} from '../../../helpers/constants/design-system';
import { useI18nContext } from '../../../hooks/useI18nContext';

// note: this is not meant to be merged
// we should convert MenuItem to TS instead of casting as any
const TsMenuItem = MenuItem as any;

export const ConnectedAccountsMenu = ({
  isOpen,
  anchorElement,
  onClose,
}: {
  isOpen: boolean;
  anchorElement?: HTMLElement;
  onClose?: () => void;
}) => {
  const t = useI18nContext();
  const popoverDialogRef = useRef<HTMLDivElement | null>(null);

  const handleKeyDown = useCallback(
    (event) => {
      if (
        event.key === 'Tab' &&
        event.target === popoverDialogRef.current &&
        onClose
      ) {
        onClose();
      }
    },
    [onClose],
  );

  return (
    <Popover
      className="multichain-connected-accounts-menu__popover"
      referenceElement={anchorElement}
      role={PopoverRole.Dialog}
      position={PopoverPosition.Bottom}
      offset={[0, 0]}
      padding={0}
      isOpen={isOpen}
      flip
      preventOverflow
      isPortal
    >
      <ModalFocus
        restoreFocus
        initialFocusRef={{ current: anchorElement || null }}
      >
        <Box onKeyDown={handleKeyDown} ref={popoverDialogRef}>
          <TsMenuItem onClick={() => {}} iconName={IconName.SecurityTick}>
            <Text variant={TextVariant.bodyMd}>{t('permissionDetails')}</Text>
          </TsMenuItem>
          <TsMenuItem onClick={() => {}} iconName={IconName.SwapHorizontal}>
            <Text variant={TextVariant.bodyMd}>{t('switchToThisAccount')}</Text>
          </TsMenuItem>
          <TsMenuItem
            onClick={() => {}}
            iconName={IconName.Logout}
            iconColor={IconColor.errorDefault}
          >
            <Text color={TextColor.errorDefault} variant={TextVariant.bodyMd}>
              {t('disconnect')}
            </Text>
          </TsMenuItem>
        </Box>
      </ModalFocus>
    </Popover>
  );
};