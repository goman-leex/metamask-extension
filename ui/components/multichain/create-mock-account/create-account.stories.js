import React from 'react';
import { CreateMockAccount } from '.';

export default {
  title: 'Components/Multichain/CreateMockAccount',
  component: CreateMockAccount,
};

export const DefaultStory = (args) => <CreateMockAccount {...args} />;
DefaultStory.storyName = 'Default';
