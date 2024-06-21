import PropTypes from 'prop-types';
import React, { Component } from 'react';
///: BEGIN:ONLY_INCLUDE_IF(snaps)
import {
  SnapCaveatType,
  WALLET_SNAP_PERMISSION_KEY,
} from '@metamask/snaps-rpc-methods';
///: END:ONLY_INCLUDE_IF
import { SubjectType } from '@metamask/permission-controller';
import { MetaMetricsEventCategory } from '../../../../shared/constants/metametrics';
import { PageContainerFooter } from '../../ui/page-container';
import PermissionsConnectFooter from '../permissions-connect-footer';
///: BEGIN:ONLY_INCLUDE_IF(snaps)
import { RestrictedMethods } from '../../../../shared/constants/permissions';
import { PermissionNames } from '../../../../app/scripts/controllers/permissions';

import SnapPrivacyWarning from '../snaps/snap-privacy-warning';
import { getDedupedSnaps } from '../../../helpers/utils/util';
import { containsEthPermissionsAndNonEvmAccount } from '../../../helpers/utils/permissions';
///: END:ONLY_INCLUDE_IF
import {
  BackgroundColor,
  Display,
  FlexDirection,
} from '../../../helpers/constants/design-system';
import { Box } from '../../component-library';
import { PermissionPageContainerContent } from '.';

export default class PermissionPageContainer extends Component {
  static propTypes = {
    approvePermissionsRequest: PropTypes.func.isRequired,
    rejectPermissionsRequest: PropTypes.func.isRequired,
    selectedAccounts: PropTypes.array,
    allAccountsSelected: PropTypes.bool,
    ///: BEGIN:ONLY_INCLUDE_IF(snaps)
    currentPermissions: PropTypes.object,
    snapsInstallPrivacyWarningShown: PropTypes.bool.isRequired,
    setSnapsInstallPrivacyWarningShownStatus: PropTypes.func,
    ///: END:ONLY_INCLUDE_IF
    request: PropTypes.object,
    requestMetadata: PropTypes.object,
    targetSubjectMetadata: PropTypes.shape({
      name: PropTypes.string,
      origin: PropTypes.string.isRequired,
      subjectType: PropTypes.string.isRequired,
      extensionId: PropTypes.string,
      iconUrl: PropTypes.string,
    }),
    history: PropTypes.object.isRequired,
    connectPath: PropTypes.string.isRequired,
  };

  static defaultProps = {
    request: {},
    requestMetadata: {},
    selectedAccounts: [],
    allAccountsSelected: false,
    ///: BEGIN:ONLY_INCLUDE_IF(snaps)
    currentPermissions: {},
    ///: END:ONLY_INCLUDE_IF
  };

  static contextTypes = {
    t: PropTypes.func,
    trackEvent: PropTypes.func,
  };

  state = {};

  getRequestedPermissions() {
    return Object.entries(this.props.request.permissions ?? {}).reduce(
      (acc, [permissionName, permissionValue]) => {
        ///: BEGIN:ONLY_INCLUDE_IF(snaps)
        if (permissionName === RestrictedMethods.wallet_snap) {
          acc[permissionName] = this.getDedupedSnapPermissions();
          return acc;
        }
        ///: END:ONLY_INCLUDE_IF
        acc[permissionName] = permissionValue;
        return acc;
      },
      {},
    );
  }

  ///: BEGIN:ONLY_INCLUDE_IF(snaps)
  getDedupedSnapPermissions() {
    const { request, currentPermissions } = this.props;
    const snapKeys = getDedupedSnaps(request, currentPermissions);
    const permission = request?.permissions?.[WALLET_SNAP_PERMISSION_KEY] || {};
    return {
      ...permission,
      caveats: [
        {
          type: SnapCaveatType.SnapIds,
          value: snapKeys.reduce((caveatValue, snapId) => {
            caveatValue[snapId] = {};
            return caveatValue;
          }, {}),
        },
      ],
    };
  }

  showSnapsPrivacyWarning() {
    this.setState({
      isShowingSnapsPrivacyWarning: true,
    });
  }
  ///: END:ONLY_INCLUDE_IF

  componentDidMount() {
    this.context.trackEvent({
      category: MetaMetricsEventCategory.Auth,
      event: 'Tab Opened',
      properties: {
        action: 'Connect',
        legacy_event: true,
      },
    });

    ///: BEGIN:ONLY_INCLUDE_IF(snaps)
    if (this.props.request.permissions[WALLET_SNAP_PERMISSION_KEY]) {
      if (this.props.snapsInstallPrivacyWarningShown === false) {
        this.showSnapsPrivacyWarning();
      }
    }
    ///: END:ONLY_INCLUDE_IF
  }

  goBack() {
    const { history, connectPath } = this.props;
    history.push(connectPath);
  }

  onCancel = () => {
    const { request, rejectPermissionsRequest } = this.props;
    rejectPermissionsRequest(request.metadata.id);
  };

  onSubmit = () => {
    const {
      request: _request,
      approvePermissionsRequest,
      rejectPermissionsRequest,
      selectedAccounts,
    } = this.props;

    const request = {
      ..._request,
      permissions: { ..._request.permissions },
      ...(_request.permissions.eth_accounts && {
        approvedAccounts: selectedAccounts.map(
          (selectedAccount) => selectedAccount.address,
        ),
      }),
      ...(_request.permissions.permittedChains && {
        approvedChainIds: _request.permissions?.permittedChains?.caveats.find(
          (caveat) => caveat.type === 'restrictNetworkSwitching',
        )?.value,
      }),
    };

    if (Object.keys(request.permissions).length > 0) {
      approvePermissionsRequest(request);
    } else {
      rejectPermissionsRequest(request.metadata.id);
    }
  };

  onLeftFooterClick = () => {
    const requestedPermissions = this.getRequestedPermissions();
    if (requestedPermissions[PermissionNames.permittedChains] === undefined) {
      this.goBack();
    } else {
      this.onCancel();
    }
  };

  render() {
    const {
      requestMetadata,
      targetSubjectMetadata,
      selectedAccounts,
      allAccountsSelected,
    } = this.props;

    const requestedPermissions = this.getRequestedPermissions();

    ///: BEGIN:ONLY_INCLUDE_IF(snaps)
    const setIsShowingSnapsPrivacyWarning = (value) => {
      this.setState({
        isShowingSnapsPrivacyWarning: value,
      });
    };

    const confirmSnapsPrivacyWarning = () => {
      setIsShowingSnapsPrivacyWarning(false);
      this.props.setSnapsInstallPrivacyWarningShownStatus(true);
    };
    ///: END:ONLY_INCLUDE_IF

    const footerLeftActionText = requestedPermissions[
      PermissionNames.permittedChains
    ]
      ? this.context.t('cancel')
      : this.context.t('back');

    return (
      <>
        {
          ///: BEGIN:ONLY_INCLUDE_IF(snaps)
          <>
            {this.state.isShowingSnapsPrivacyWarning && (
              <SnapPrivacyWarning
                onAccepted={() => confirmSnapsPrivacyWarning()}
                onCanceled={() => this.onCancel()}
              />
            )}
          </>
          ///: END:ONLY_INCLUDE_IF
        }
        <PermissionPageContainerContent
          requestMetadata={requestMetadata}
          subjectMetadata={targetSubjectMetadata}
          selectedPermissions={requestedPermissions}
          selectedAccounts={selectedAccounts}
          allAccountsSelected={allAccountsSelected}
        />
        <Box
          display={Display.Flex}
          backgroundColor={BackgroundColor.backgroundAlternative}
          flexDirection={FlexDirection.Column}
        >
          {targetSubjectMetadata?.subjectType !== SubjectType.Snap && (
            <PermissionsConnectFooter />
          )}
          <PageContainerFooter
            footerClassName="permission-page-container-footer"
            cancelButtonType="default"
            onCancel={() => this.onLeftFooterClick()}
            cancelText={footerLeftActionText}
            onSubmit={() => this.onSubmit()}
            submitText={this.context.t('confirm')}
            buttonSizeLarge={false}
            disabled={containsEthPermissionsAndNonEvmAccount(
              selectedAccounts,
              requestedPermissions,
            )}
          />
        </Box>
      </>
    );
  }
}
