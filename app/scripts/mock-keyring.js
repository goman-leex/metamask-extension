const { EventEmitter } = require('events');
const ethUtil = require('ethereumjs-util');
const { TransactionFactory } = require('@ethereumjs/tx');

const keyringType = 'Mock Keyring';

/**
 * Check if the given transaction is made with ethereumjs-tx or @ethereumjs/tx
 *
 * Transactions built with older versions of ethereumjs-tx have a
 * getChainId method that newer versions do not.
 * Older versions are mutable
 * while newer versions default to being immutable.
 * Expected shape and type
 * of data for v, r and s differ (Buffer (old) vs BN (new)).
 *
 * @param {TypedTransaction | OldEthJsTransaction} tx
 * @returns {tx is OldEthJsTransaction} Returns `true` if tx is an old-style ethereumjs-tx transaction.
 */
function isOldStyleEthereumjsTx(tx) {
  return typeof tx.getChainId === 'function';
}

class MockAccountKeyring extends EventEmitter {
  constructor(opts = {}) {
    super();
    this.type = keyringType;
    this.accounts = [];
    this.deserialize(opts);
  }

  serialize() {
    return Promise.resolve({
      accounts: this.accounts,
    });
  }

  deserialize(opts = {}) {
    this.accounts = opts.accounts || [];
    return Promise.resolve();
  }

  addAccounts(accounts) {
    return new Promise((resolve) => {
      this.accounts.push(...accounts);
      resolve(this.accounts);
    });
  }

  getAccounts() {
    return Promise.resolve(this.accounts.slice());
  }

  removeAccount(address) {
    if (
      !this.accounts.map((a) => a.toLowerCase()).includes(address.toLowerCase())
    ) {
      throw new Error(`Address ${address} not found in this keyring`);
    }

    this.accounts = this.accounts.filter(
      (a) => a.toLowerCase() !== address.toLowerCase(),
    );
  }

  /**
   * Signs a transaction using Trezor.
   *
   * Accepts either an ethereumjs-tx or @ethereumjs/tx transaction, and returns
   * the same type.
   *
   * @template {TypedTransaction | OldEthJsTransaction} Transaction
   * @param {string} address - Hex string address.
   * @param {Transaction} tx - Instance of either new-style or old-style ethereumjs transaction.
   * @returns {Promise<Transaction>} The signed transaction, an instance of either new-style or old-style
   * ethereumjs transaction.
   */
  signTransaction(address, tx) {
    if (isOldStyleEthereumjsTx(tx)) {
      // In this version of ethereumjs-tx we must add the chainId in hex format
      // to the initial v value. The chainId must be included in the serialized
      // transaction which is only communicated to ethereumjs-tx in this
      // value. In newer versions the chainId is communicated via the 'Common'
      // object.
      return this._signTransaction(address, tx.getChainId(), tx, () => {
        return TransactionFactory.fromTxData(tx, {
          common: tx.common,
        });
      });
    }
    return this._signTransaction(
      address,
      tx.common.chainIdBN().toNumber(),
      tx,
      () => {
        // Because tx will be immutable, first get a plain javascript object that
        // represents the transaction. Using txData here as it aligns with the
        // nomenclature of ethereumjs/tx.
        const txData = tx.toJSON();
        // The fromTxData utility expects a type to support transactions with a type other than 0
        txData.type = tx.type;
        // Adopt the 'common' option from the original transaction and set the
        // returned object to be frozen if the original is frozen.
        return TransactionFactory.fromTxData(txData, {
          common: tx.common,
          freeze: Object.isFrozen(tx),
        });
      },
    );
  }

  /**
   *
   * @template {TypedTransaction | OldEthJsTransaction} Transaction
   * @param {string} address - Hex string address.
   * @param {number} chainId - Chain ID
   * @param {Transaction} tx - Instance of either new-style or old-style ethereumjs transaction.
   * @param {(import('trezor-connect').EthereumSignedTx) => Transaction} handleSigning - Converts signed transaction
   * to the same new-style or old-style ethereumjs-tx.
   * @returns {Promise<Transaction>} The signed transaction, an instance of either new-style or old-style
   * ethereumjs transaction.
   */
  async _signTransaction(address, chainId, tx, handleSigning) {
    let transaction;
    if (isOldStyleEthereumjsTx(tx)) {
      // legacy transaction from ethereumjs-tx package has no .toJSON() function,
      // so we need to convert to hex-strings manually manually
      transaction = {
        to: this._normalize(tx.to),
        value: this._normalize(tx.value),
        data: this._normalize(tx.data),
        chainId,
        nonce: this._normalize(tx.nonce),
        gasLimit: this._normalize(tx.gasLimit),
        gasPrice: this._normalize(tx.gasPrice),
      };
    } else {
      // new-style transaction from @ethereumjs/tx package
      // we can just copy tx.toJSON() for everything except chainId, which must be a number
      transaction = {
        ...tx.toJSON(),
        chainId,
        to: this._normalize(tx.to),
      };
    }
    return handleSigning(transaction);
  }

  signMessage(withAccount, data) {
    return this.signPersonalMessage(withAccount, data);
  }

  signPersonalMessage(withAccount, message) {
    return Promise.reject(new Error('Sign message is not supported.'));
  }

  /**
   * EIP-712 Sign Typed Data
   */
  async signTypedData(address, data, { version }) {
    return Promise.reject(new Error('Sign typed data is not supported.'));
  }

  exportAccount() {
    return Promise.reject(new Error('Export account is not supported.'));
  }

  /* PRIVATE METHODS */

  _normalize(buf) {
    return ethUtil.bufferToHex(buf).toString();
  }
}

MockAccountKeyring.type = keyringType;
module.exports = MockAccountKeyring;
