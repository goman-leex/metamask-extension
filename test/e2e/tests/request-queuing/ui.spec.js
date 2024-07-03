const { strict: assert } = require('assert');
const FixtureBuilder = require('../../fixture-builder');
const {
  withFixtures,
  openDapp,
  unlockWallet,
  DAPP_URL,
  DAPP_ONE_URL,
  regularDelayMs,
  WINDOW_TITLES,
  defaultGanacheOptions,
  switchToNotificationWindow,
  veryLargeDelayMs,
} = require('../../helpers');
const { PAGES } = require('../../webdriver/driver');

async function openDappAndSwitchChain(driver, dappUrl, chainId) {
  const notificationWindowIndex = chainId ? 4 : 3;

  // Open the dapp
  await openDapp(driver, undefined, dappUrl);
  await driver.delay(regularDelayMs);

  // Connect to the dapp
  await driver.findClickableElement({ text: 'Connect', tag: 'button' });
  await driver.clickElement('#connectButton');
  await driver.delay(regularDelayMs);
  await switchToNotificationWindow(driver, notificationWindowIndex);
  await driver.clickElement({
    text: 'Next',
    tag: 'button',
    css: '[data-testid="page-container-footer-next"]',
  });
  await driver.clickElement({
    text: 'Confirm',
    tag: 'button',
    css: '[data-testid="page-container-footer-next"]',
  });

  // Switch back to the dapp
  await driver.switchToWindowWithUrl(dappUrl);

  // Switch chains if necessary
  if (chainId) {
    await driver.delay(veryLargeDelayMs);
    const switchChainRequest = JSON.stringify({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId }],
    });

    await driver.executeScript(
      `window.ethereum.request(${switchChainRequest})`,
    );

    await driver.delay(veryLargeDelayMs);
    await switchToNotificationWindow(driver, notificationWindowIndex);

    await driver.findClickableElement(
      '[data-testid="confirmation-submit-button"]',
    );
    await driver.clickElement('[data-testid="confirmation-submit-button"]');
  }
}

async function selectDappClickSendGetNetwork(driver, dappUrl) {
  await driver.switchToWindowWithUrl(dappUrl);
  // Windows: MetaMask, TestDapp1, TestDapp2
  const expectedWindowHandles = 3;
  await driver.waitUntilXWindowHandles(expectedWindowHandles);
  const currentWindowHandles = await driver.getAllWindowHandles();
  await driver.clickElement('#sendButton');

async function selectDappClickPersonalSign(driver, dappUrl) {
  await driver.switchToWindowWithUrl(dappUrl);
  await driver.clickElement('#personalSign');
}

async function switchToNotificationPopoverValidateDetails(
  driver,
  expectedDetails,
) {
  // Switches to the MetaMask Dialog window for confirmation
  const windowHandles = await driver.getAllWindowHandles();
  await driver.switchToWindowWithTitle(WINDOW_TITLES.Dialog, windowHandles);

  const networkPill = await driver.findElement(
    // Differs between confirmation and signature
    '[data-testid="network-display"], [data-testid="signature-request-network-display"]',
  );
  const networkText = await networkPill.getText();
  const originElement = await driver.findElement(
    // Differs between confirmation and signature
    '.confirm-page-container-summary__origin bdi, .request-signature__origin .chip__label',
  );
  const originText = await originElement.getText();

  // Get state details
  const notificationWindowState = await driver.executeScript(() =>
    window.stateHooks?.getCleanAppState?.(),
  );
  const { chainId } = notificationWindowState.metamask.providerConfig;

  // Ensure accuracy
  validateConfirmationDetails(
    { networkText, originText, chainId },
    expectedDetails,
  );
}

async function rejectTransaction(driver) {
  await driver.clickElement({ tag: 'button', text: 'Reject' });
}

async function confirmTransaction(driver) {
  await driver.clickElement({ tag: 'button', text: 'Confirm' });
}

function validateConfirmationDetails(
  { chainId, networkText, originText },
  expected,
) {
  assert.equal(chainId, expected.chainId);
  assert.equal(networkText, expected.networkText);
  assert.equal(originText, expected.originText);
}

async function switchToNetworkByName(driver, networkName) {
  await driver.clickElement('[data-testid="network-display"]');
  await driver.clickElement(`[data-testid="${networkName}"]`);
}

async function validateBalanceAndActivity(
  driver,
  expectedBalance,
  expectedActivityEntries = 1,
) {
  // Ensure the balance changed if the the transaction was confirmed
  await driver.waitForSelector({
    css: '[data-testid="eth-overview__primary-currency"] .currency-display-component__text',
    text: expectedBalance,
  });

  // Ensure there's an activity entry of "Send" and "Confirmed"
  if (expectedActivityEntries) {
    await driver.clickElement('[data-testid="account-overview__activity-tab"]');
    assert.equal(
      (
        await driver.findElements({
          css: '[data-testid="activity-list-item-action"]',
          text: 'Send',
        })
      ).length,
      expectedActivityEntries,
    );
    assert.equal(
      (await driver.findElements('.transaction-status-label--confirmed'))
        .length,
      expectedActivityEntries,
    );
  }
}

describe('Request-queue UI changes', function () {
  it('should show network specific to domain @no-mmi', async function () {
    const port = 8546;
    const chainId = 1338;
    await withFixtures(
      {
        dapp: true,
        fixtures: new FixtureBuilder()
          .withNetworkControllerDoubleGanache()
          .withPreferencesControllerUseRequestQueueEnabled()
          .withSelectedNetworkControllerPerDomain()
          .build(),
        ganacheOptions: {
          ...defaultGanacheOptions,
          concurrent: [
            {
              port,
              chainId,
              ganacheOptions2: defaultGanacheOptions,
            },
          ],
        },
        dappOptions: { numberOfDapps: 2 },
        title: this.test.fullTitle(),
      },
      async ({ driver }) => {
        await unlockWallet(driver);

        // Navigate to extension home screen
        await driver.navigate(PAGES.HOME);

        // Open the first dapp
        await openDappAndSwitchChain(driver, DAPP_URL);

        // Open the second dapp and switch chains
        await openDappAndSwitchChain(driver, DAPP_ONE_URL, '0x1');

        // Go to wallet fullscreen, ensure that the global network changed to Ethereum Mainnet
        await driver.switchToWindowWithTitle(
          WINDOW_TITLES.ExtensionInFullScreenView,
        );
        await driver.findElement({
          css: '[data-testid="network-display"]',
          text: 'Ethereum Mainnet',
        });

        // Go to the first dapp, ensure it uses localhost
        const dappOneNetworkPillText = await selectDappClickSendGetNetwork(
          driver,
          DAPP_URL,
        );
        assert.equal(dappOneNetworkPillText, 'Localhost 8545');

        // Go to the second dapp, ensure it uses Ethereum Mainnet
        const dappTwoNetworkPillText = await selectDappClickSendGetNetwork(
          driver,
          DAPP_ONE_URL,
        );
        assert.equal(dappTwoNetworkPillText, 'Ethereum Mainnet');
      },
    );
  });

  it('should gracefully handle deleted network @no-mmi', async function () {
    const port = 8546;
    const chainId = 1338;
    await withFixtures(
      {
        dapp: true,
        fixtures: new FixtureBuilder()
          .withNetworkControllerDoubleGanache()
          .withPreferencesControllerUseRequestQueueEnabled()
          .withSelectedNetworkControllerPerDomain()
          .build(),
        ganacheOptions: {
          ...defaultGanacheOptions,
          concurrent: [
            {
              port,
              chainId,
              ganacheOptions2: defaultGanacheOptions,
            },
          ],
        },
        dappOptions: { numberOfDapps: 2 },
        title: this.test.fullTitle(),
      },
      async ({ driver }) => {
        await unlockWallet(driver);

        // Navigate to extension home screen
        await driver.navigate(PAGES.HOME);

        // Open the first dapp
        await openDappAndSwitchChain(driver, DAPP_URL);

        // Open the second dapp and switch chains
        await openDappAndSwitchChain(driver, DAPP_ONE_URL, '0x1', 4);

        // Go to wallet fullscreen, ensure that the global network changed to Ethereum Mainnet
        await driver.switchToWindowWithTitle(
          WINDOW_TITLES.ExtensionInFullScreenView,
        );
        await driver.findElement({
          css: '[data-testid="network-display"]',
          text: 'Ethereum Mainnet',
        });

        // Go to Settings, delete the first dapp's network
        await driver.clickElement(
          '[data-testid="account-options-menu-button"]',
        );
        await driver.clickElement('[data-testid="global-menu-settings"]');
        await driver.clickElement({
          css: '.tab-bar__tab__content__title',
          text: 'Networks',
        });
        await driver.clickElement({
          css: '.networks-tab__networks-list-name',
          text: 'Localhost 8545',
        });
        await driver.clickElement({ css: '.btn-danger', text: 'Delete' });
        await driver.clickElement({
          css: '.modal-container__footer-button',
          text: 'Delete',
        });

        // Go back to first dapp, try an action, ensure deleted network doesn't block UI
        // The current globally selected network, Ethereum Mainnet, should be used
        await selectDappClickSend(driver, DAPP_URL);
        await driver.delay(veryLargeDelayMs);
        await switchToNotificationPopoverValidateDetails(driver, {
          chainId: '0x1',
          networkText: 'Ethereum Mainnet',
          originText: DAPP_URL,
        });
      },
    );
  });

  it('should gracefully handle network connectivity failure for signatures @no-mmi', async function () {
    const port = 8546;
    const chainId = 1338;
    await withFixtures(
      {
        dapp: true,
        fixtures: new FixtureBuilder()
          .withNetworkControllerDoubleGanache()
          .withPreferencesControllerUseRequestQueueEnabled()
          .withSelectedNetworkControllerPerDomain()
          .build(),
        ganacheOptions: {
          ...defaultGanacheOptions,
          concurrent: [
            {
              port,
              chainId,
              ganacheOptions2: defaultGanacheOptions,
            },
          ],
        },
        // This test intentionally quits Ganache while the extension is using it, causing
        // PollingBlockTracker errors. These are expected.
        ignoredConsoleErrors: ['PollingBlockTracker'],
        dappOptions: { numberOfDapps: 2 },
        title: this.test.fullTitle(),
      },
      async ({ driver, ganacheServer, secondaryGanacheServer }) => {
        await unlockWallet(driver);

        // Navigate to extension home screen
        await driver.navigate(PAGES.HOME);

        // Open the first dapp
        await openDappAndSwitchChain(driver, DAPP_URL);

        // Open the second dapp and switch chains
        await openDappAndSwitchChain(driver, DAPP_ONE_URL, '0x1', 4);

        // Go to wallet fullscreen, ensure that the global network changed to Ethereum Mainnet
        await driver.switchToWindowWithTitle(
          WINDOW_TITLES.ExtensionInFullScreenView,
        );
        await driver.findElement({
          css: '[data-testid="network-display"]',
          text: 'Ethereum Mainnet',
        });

        // Kill ganache servers
        await ganacheServer.quit();
        await secondaryGanacheServer[0].quit();

        // Go back to first dapp, try an action, ensure network connection failure doesn't block UI
        await selectDappClickPersonalSign(driver, DAPP_URL);
        await driver.delay(veryLargeDelayMs);
        await switchToNotificationPopoverValidateDetails(driver, {
          chainId: '0x539',
          networkText: 'Localhost 8545',
          originText: DAPP_URL,
        });
      },
    );
  });

  it('should gracefully handle network connectivity failure for confirmations @no-mmi', async function () {
    const port = 8546;
    const chainId = 1338;
    await withFixtures(
      {
        dapp: true,
        // Presently confirmations take up to 10 seconds to display on a dead network
        driverOptions: { timeOut: 30000 },
        fixtures: new FixtureBuilder()
          .withNetworkControllerDoubleGanache()
          .withPreferencesControllerUseRequestQueueEnabled()
          .withSelectedNetworkControllerPerDomain()
          .build(),
        ganacheOptions: {
          ...defaultGanacheOptions,
          concurrent: [
            {
              port,
              chainId,
              ganacheOptions2: defaultGanacheOptions,
            },
          ],
        },
        // This test intentionally quits Ganache while the extension is using it, causing
        // PollingBlockTracker errors. These are expected.
        ignoredConsoleErrors: ['PollingBlockTracker'],
        dappOptions: { numberOfDapps: 2 },
        title: this.test.fullTitle(),
      },
      async ({ driver, ganacheServer, secondaryGanacheServer }) => {
        await unlockWallet(driver);

        // Navigate to extension home screen
        await driver.navigate(PAGES.HOME);

        // Open the first dapp
        await openDappAndSwitchChain(driver, DAPP_URL);

        // Open the second dapp and switch chains
        await openDappAndSwitchChain(driver, DAPP_ONE_URL, '0x1', 4);

        // Go to wallet fullscreen, ensure that the global network changed to Ethereum Mainnet
        await driver.switchToWindowWithTitle(
          WINDOW_TITLES.ExtensionInFullScreenView,
        );
        await driver.findElement({
          css: '[data-testid="network-display"]',
          text: 'Ethereum Mainnet',
        });

        // Kill ganache servers
        await ganacheServer.quit();
        await secondaryGanacheServer[0].quit();

        // Go back to first dapp, try an action, ensure network connection failure doesn't block UI
        await selectDappClickSend(driver, DAPP_URL);
        await switchToNotificationPopoverValidateDetails(driver, {
          chainId: '0x539',
          networkText: 'Localhost 8545',
          originText: DAPP_URL,
        });
      },
    );
  });
});
