import { Api, JsonRpc, Serialize } from '@jafri/eosjs2'
import { JsSignatureProvider } from '@jafri/eosjs2/dist/eosjs-jssig'
import fetch from 'node-fetch'
import { TextEncoder, TextDecoder } from 'text-encoding'
import { readFileSync } from 'fs'
import { getDeployableFilesFromDir } from './deploy'
import { EOSIO_TOKEN } from './constants'
import { Account } from './interfaces'
const BN = require('bn.js')

const transformEthAccount = (account: Account) => {
  account.address = `0x${account.address}`
  account.balance = new BN(account.balance, 16)._strip()
  return account
}

/**
 * Telos API used as a subset of EosEvmApi
 *
 * @param {object} args Arguments
 * @param {Array<string>} args.telosPrivateKeys Telos private keys
 * @param {Array<string>} args.endpoint Telos RPC endpoint
 * @param {Array<string>} args.telosContract Telos contract name with EVM
 */
export class TelosApi {
  telosPrivateKeys: Array<string>
  signatureProvider: any
  rpc: any
  api: any
  telosContract: string

  constructor({
    telosPrivateKeys,
    endpoint,
    telosContract
  }: {
    telosPrivateKeys: Array<string>
    endpoint: string
    telosContract: string
  }) {
    this.telosPrivateKeys = telosPrivateKeys
    this.signatureProvider = new JsSignatureProvider(this.telosPrivateKeys)
    this.rpc = new JsonRpc(endpoint, { fetch: fetch as any })
    this.api = new Api({
      rpc: this.rpc,
      signatureProvider: this.signatureProvider,
      textEncoder: new TextEncoder() as any,
      textDecoder: new TextDecoder() as any
    })
    this.telosContract = telosContract
  }

  /**
   * Bundles actions into a transaction to send to Telos Api
   *
   * @param {any[]} actionsFull Telos actions
   * @returns {Promise<any>} EVM receipt and Telos receipt
   */
  async transact(actions: any[]) {
    try {
      const result = await this.api.transact(
        {
          actions
        },
        {
          blocksBehind: 3,
          expireSeconds: 3000,
          broadcast: true,
          sign: true
        }
      )
      return result
    } catch (e) {
      // if (e.json) {
      //   console.log(e.json.error.details[0].message)
      // } else {
      //   console.dir(e, { depth: null })
      // }
      throw e
    }
  }

  /**
   * Sends a ETH TX to EVM
   *
   * @param {object} args Arguments
   * @param {string} args.account Telos account to interact with EVM
   * @param {string} args.txRaw RLP encoded hex string
   * @param {string} args.senderThe ETH address of an account if tx is not signed
   * @returns {Promise<EvmResponse>} EVM receipt and Telos receipt
   */
  async raw({
    account,
    tx,
    sender
  }: {
    account: string
    tx: string
    sender?: string
  }) {
    if (tx && tx.startsWith('0x')) tx = tx.substring(2)
    if (sender && sender.startsWith('0x')) sender = sender.substring(2)

    let response: any = {}
    response.telos = await this.transact([
      {
        account: this.telosContract,
        name: 'raw',
        data: {
          ram_payer: account,
          tx,
          sender
        },
        authorization: [{ actor: account, permission: 'active' }]
      }
    ])

    try {
      response.eth = JSON.parse(
        response.telos.processed.action_traces[0].console
      )
    } catch (e) {
      response.eth = ''
      console.log(
        'Could not parse',
        response.telos.processed.action_traces[0].console
      )
    }

    if (response.eth === '') {
      console.warn('Warning: This node may have console printing disabled')
    }

    return response
  }

  /**
   * Sends a non state modifying call to EVM
   *
   * @param {object} args Arguments
   * @param {string} args.account Telos account to interact with EVM
   * @param {string} args.txRaw RLP encoded hex string
   * @param {string} args.senderThe ETH address of an account if tx is not signed
   * @returns {Promise<string>} Hex encoded output
   */
  async call({
    account,
    tx,
    sender
  }: {
    account: string
    tx: string
    sender?: string
  }) {
    if (tx && tx.startsWith('0x')) tx = tx.substring(2)
    if (sender && sender.startsWith('0x')) sender = sender.substring(2)

    try {
      await this.transact([
        {
          account: this.telosContract,
          name: 'call',
          data: {
            ram_payer: account,
            tx,
            sender
          },
          authorization: [{ actor: account, permission: 'active' }]
        }
      ])
    } catch (e) {
      const error = e.json.error
      if (error.code !== 3050003) {
        throw new Error('This node does not have console printing enabled')
      }
      const message = error.details[1].message
      const result = message.replace('pending console output: ', '')
      return result
    }
  }

  /**
   * Creates EVM address from Telos account
   *
   * @param {object} args Arguments
   * @param {string} args.account Telos account to interact with EVM
   * @param {string} args.data Arbitrary string used as salt to generate new address
   * @returns {Promise<any>} Telos TX Response
   */
  async create({ account, data }: { account: string; data: string }) {
    return await this.transact([
      {
        account: this.telosContract,
        name: 'create',
        data: {
          account,
          data
        },
        authorization: [{ actor: account, permission: 'active' }]
      }
    ])
  }

  /**
   * Withdraws token from EVM
   *
   * @param {object} args Arguments
   * @param {string} args.account Telos account to interact with EVM
   * @param {string} args.quantity Telos asset type quantity to withdraw (0.0001 TLOS)
   * @returns {Promise<any>} Telos TX Response
   */
  async withdraw({ account, quantity }: { account: string; quantity: string }) {
    return await this.transact([
      {
        account: this.telosContract,
        name: 'withdraw',
        data: {
          to: account,
          quantity
        },
        authorization: [{ actor: account, permission: 'active' }]
      }
    ])
  }

  /**
   * Deposits token into EVM
   *
   * @param {object} args Arguments
   * @param {string} args.from Telos account to interact with EVM
   * @param {string} args.quantity Telos asset type quantity to deposit (0.0001 TLOS)
   * @param {string} args.memo Memo to transfer
   * @returns {Promise<any>} Telos TX Response
   */
  async deposit({
    from,
    quantity,
    memo = ''
  }: {
    from: string
    quantity: string
    memo?: string
  }) {
    return await this.transact([
      {
        account: EOSIO_TOKEN,
        name: 'transfer',
        data: {
          from,
          to: this.telosContract,
          quantity,
          memo
        },
        authorization: [{ actor: from, permission: 'active' }]
      }
    ])
  }

  /**
   * Testing: Clears all data in contract
   *
   * @returns {Promise<any>} Telos TX response
   */
  async clearAll() {
    return await this.transact([
      {
        account: this.telosContract,
        name: 'clearall',
        data: {},
        authorization: [{ actor: this.telosContract, permission: 'active' }]
      }
    ])
  }
  /**
   * Testing: Creates account for eth tests
   *
   * @returns {Promise<any>} Telos TX response
   */
  async devNewAccount(
    address: string,
    balance: string,
    code: string,
    nonce: number,
    account: string = ''
  ) {
    return await this.transact([
      {
        account: this.telosContract,
        name: 'devnewacct',
        data: {
          address,
          balance,
          code: Uint8Array.from(Buffer.from(code, 'hex')),
          nonce,
          account
        },
        authorization: [{ actor: this.telosContract, permission: 'active' }]
      }
    ])
  }

  /**
   * Fetches tables based on data
   *
   * @returns {Promise<any>} Telos RPC Get tables row response
   */
  async getTable(data: any) {
    const defaultParams = {
      json: true, // Get the response as json
      code: '', // Contract that we target
      scope: '', // Account that owns the data
      table: '', // Table name
      key_type: `i64`, // Type of key
      index_position: 1, // Position of index
      lower_bound: '', // Table secondary key value
      limit: 10, // Here we limit to 10 to get ten row
      reverse: false, // Optional: Get reversed data
      show_payer: false // Optional: Show ram payer
    }
    const params = Object.assign({}, defaultParams, data)
    return await this.api.rpc.get_table_rows(params)
  }

  /**
   * Gets all accounts
   *
   * @param contract The Telos contract with EVM deplyoed
   *
   * @returns {Promise<Account[]>} all accounts
   */
  async getAllAddresses() {
    const { rows } = await this.getTable({
      code: this.telosContract,
      scope: this.telosContract,
      table: 'account',
      key_type: 'i64',
      index_position: 1,
      limit: -1
    })
    return rows.map(transformEthAccount)
  }

  /**
   * Gets the on-chain account
   *
   * @param contract The Telos contract with EVM deplyoed
   * @param address The ETH address in contract
   *
   * @returns {Promise<Account>} Account row associated with address
   */
  async getEthAccount(address: string): Promise<Account> {
    if (!address) throw new Error('No address provided')
    if (address.startsWith('0x')) address = address.substring(2)

    const padded = '0'.repeat(12 * 2) + address

    const { rows } = await this.getTable({
      code: this.telosContract,
      scope: this.telosContract,
      table: 'account',
      key_type: 'sha256',
      index_position: 2,
      lower_bound: padded,
      upper_bound: padded,
      limit: 1
    })

    if (rows.length && rows[0].address === address) {
      return transformEthAccount(rows[0])
    } else {
      throw new Error(`Account with address ${address} not found`)
    }
  }

  /**
   * Gets nonce for given address
   *
   * @param contract The Telos contract with EVM deplyoed
   * @param address The ETH address in contract
   *
   * @returns Hex-encoded nonce
   */

  /**
   * Fetches the nonce for an account
   *
   * @param address The ETH address in EVM contract
   *
   * @returns {Promise<string>} Hex encoded nonce
   */
  async getNonce(address: any) {
    if (!address) return '0x0'

    try {
      const account = await this.getEthAccount(address)
      return `0x${account.nonce.toString(16)}`
    } catch (e) {
      console.log(e)
      return '0x0'
    }
  }

  /**
   * Fetches the on-chain storage value at address and key
   *
   * @param address The ETH address in EVM contract
   * @param key Storage key
   *
   * @returns {Promise<AccountState>} account state row containing key and value
   */
  async getStorageAt(address: string, key: string) {
    if (!address || !key) throw new Error('Both address and key are required')
    if (address && address.startsWith('0x')) address = address.substring(2)

    if (key && key.startsWith('0x')) key = key.substring(2)
    const paddedKey = '0'.repeat(64 - key.length) + key

    const { index } = await this.getEthAccount(address)
    const { rows } = await this.getTable({
      code: this.telosContract,
      scope: index,
      table: 'accountstate',
      key_type: 'sha256',
      index_position: 2,
      lower_bound: paddedKey,
      upper_bound: paddedKey,
      limit: 1
    })

    if (rows.length && rows[0].key === key) {
      return '0x' + rows[0].value
    } else {
      return '0x0'
    }
  }

  /**
   * Gets the on-chain evm account by telos account name
   *
   * @param account The Telos contract linked to ETH address
   *
   * @returns {Promise<Account>}
   */
  async getEthAccountByTelosAccount(account: string) {
    const { rows } = await this.getTable({
      code: this.telosContract,
      scope: this.telosContract,
      table: 'account',
      key_type: 'i64',
      index_position: 3,
      lower_bound: account,
      upper_bound: account,
      limit: 1
    })

    if (rows.length && rows[0].account === account) {
      return transformEthAccount(rows[0])
    } else {
      throw new Error(`No address associated with ${account}`)
    }
  }
}
