import { api, initialAccount, contractDir, contract } from './common'
const BN = require('bn.js')

describe('Full ERC20 Test', () => {
  jest.setTimeout(30000)

  describe('Create Address and deposit TLOS', () => {
    it('clears all (dev only, remove in prod)', async () => {
      await api.tlos.clearAll()
      const rows = await api.tlos.getAllAddresses()
      expect(rows.length).toEqual(0)
    })

    it(`setups contract at ${contract}`, async () => {
      await api.tlos.setupEvmContract(contractDir)
      expect(await api.tlos.rpc.getRawAbi(contract)).toBeTruthy()
    })

    it(`Pre-create accounts`, async () => {
      await api.tlos.devNewAccount(
        'a94f5374fce5edbc8e2a8697c15331677e6ebf0b',
        '1000000000000000000',
        '',
        1
      )
      await api.tlos.devNewAccount(
        'b94f5374fce5edbc8e2a8697c15331677e6ebf0b',
        '0',
        '60203560205260403560405260603560605260803560805260a03560a05260c03560c05260e03560e052610100356101005261012035610120526101403561014052610160356101605261018035610180526101a0356101a0526101c0356101c0526101e0356101e052610200356102005261022035610220526102403561024052610260356102605261028035610280526102a0356102a0526102c0356102c0526102e0356102e05260206103e86000356020600060086207a120f26000556103e85160015500',
        0
      )
      await api.tlos.devNewAccount(
        'c94f5374fce5edbc8e2a8697c15331677e6ebf0b',
        '0',
        '06000356000526020356020527f30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f000000060405260406103e86060600060006007624c4b40f26000556103e8516001556104085160025500',
        0
      )
      await api.tlos.devNewAccount(
        'd94f5374fce5edbc8e2a8697c15331677e6ebf0b',
        '0',
        '60003560005260203560205260403560405260603560605260406103e86080600060006006624c4b40f26000556103e8516001556104085160025500',
        0
      )
      expect(true).toBeTruthy()
    })

    it(`TX`, async () => {
      await api.tlos.raw({
        account: 'vestvestvest',
        tx:
          'f9020201018398968094b94f5374fce5edbc8e2a8697c15331677e6ebf0b80b901a000000000000000000000000000000000000000000000000000000000000001801c76476f4def4bb94541d57ebba1193381ffa7aa76ada664dd31c16024c43f593034dd2920f673e204fee2811c678745fc819b55d3e9d294e45c9b03a76aef41209dd15ebff5d46c4bd888e51a93cf99a7329636c63514396b4a452003a35bf704bf11ca01483bfa8b34b43561848d28905960114c8ac04049af4b6315a416782bb8324af6cfc93537a2ad1a445cfd0ca2a71acd7ac41fadbf933c2a51be344d120a2a4cf30c1bf9845f20c6fe39e07ea2cce61f0c9bb048165fe5e4de877550111e129f1cf1097710d41c4ac70fcdfa5ba2023c6ff1cbeac322de49d1b6df7c2032c61a830e3c17286de9462bf242fca2883585b93870a73853face6a6bf411198e9393920d483a7260bfb731fb5d25f1aa493335a9e71297e485b7aef312c21800deef121f1e76426a00665e5c4479674322d4f75edadd46debd5cd992f6ed090689d0585ff075ec9e99ad690c3395bc4b313370b38ef355acdadcd122975b12c85ea5db8c6deb4aab71808dcb408fe3d1e7690c43d37b4ce6cc0166fa7daa1ba0872d7e999e673310b36b2ca6f36aaf35759f462e7df2ec248f51ae7a0eec1299a054506b8c9e8460f834fce211e28616cbcb005e3bf89d691a4942debb4198a088'
      })
      expect(true).toBeTruthy()
    })
  })
})
