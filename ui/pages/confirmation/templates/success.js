import {
  FontWeight,
  TextAlign,
  BlockSize,
  AlignItems,
  FlexDirection,
  JustifyContent,
  TypographyVariant,
} from '../../../helpers/constants/design-system';
import { processString } from '../util';

function getValues(pendingApproval, t, actions, _history) {
  return {
    content: [
      {
        key: 'container',
        element: 'Box',
        props: {
          flexDirection: FlexDirection.Column,
          alignItems: AlignItems.center,
          justifyContent: JustifyContent.center,
          height: BlockSize.Full,
          paddingTop: 2,
          paddingBottom: 2,
        },
        children: [
          {
            key: 'heading',
            element: 'Typography',
            props: {
              variant: TypographyVariant.H3,
              fontWeight: FontWeight.Bold,
              paddingBottom: 2,
            },
            children: 'Success',
          },
          {
            key: 'message',
            element: 'Typography',
            props: {
              textAlign: TextAlign.Center,
            },
            children: processString(
              pendingApproval.requestData.message,
              'The operation completed successfully',
            ),
          },
        ],
      },
    ],
    submitText: t('ok'),
    onSubmit: () =>
      actions.resolvePendingApproval(
        pendingApproval.id,
        pendingApproval.requestData,
      ),
    networkDisplay: false,
  };
}

const success = {
  getValues,
};

export default success;
