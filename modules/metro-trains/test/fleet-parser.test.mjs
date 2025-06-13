import { expect } from 'chai'
import { getLeadingVehicles, getMotorVehicles, parseConsist, parseConsistFromMotors } from '../fleet-parser.js'

let fleet = [
  ['1M','1301T','2M'],['3M','1302T','4M'],['5M','1303T','6M'],['7M','1304T','8M'],
  ['9001','9101','9201','9301','9701','9801','9901'],['9002','9102','9202','9302','9702','9802','9902'],['9003','9103','9203','9303','9703','9803','9903']
]

describe('The fleet parser functions', () => {
  describe('The getLeadingVehicles function', () => {
    it('Should take a POTS consist and extact the unique motor cars a MTM-MTM type consist', () => {
      expect(getLeadingVehicles(getMotorVehicles('1303T-1304T-5M-6M-7M-8M'))).to.have.members(['5M', '7M'])
    })

    it('Should take a POTS consist and extact the lower motor cars an HCMT', () => {
      expect(getLeadingVehicles(getMotorVehicles('9002M-9902M'))).to.have.members(['9002'])
    })

    it('Should handle XT2 in the format 8001M-8601M', () => {
      expect(getLeadingVehicles(getMotorVehicles('8001M-8601M'))).to.have.members(['8001'])
    })
  })

  describe('The getMotorVehicles function', () => {
    it('Should return just the motor numbers', () => {
      expect(getMotorVehicles('1303T-1304T-5M-6M-7M-8M')).to.have.members(['5M', '6M', '7M', '8M'])
    })
    it('Should return just the number for HCMTs', () => {
      expect(getMotorVehicles('9001M-9901M')).to.have.members(['9001', '9901'])
    })
  })

  describe('The parseConsist function', () => {
    it('Should take the scrambled MTM type POTS consist and unscramble it', () => {
      expect(parseConsist('1303T-1304T-5M-6M-7M-8M', fleet)).to.deep.equal([
        ['5M', '1303T', '6M'], ['7M', '1304T', '8M'],
      ])

      expect(parseConsist('9002M-9902M', fleet)).to.deep.equal([
        ['9002','9102','9202','9302','9702','9802','9902']
      ])

      expect(parseConsistFromMotors(['9002', '9902'], fleet)).to.deep.equal([
        ['9002','9102','9202','9302','9702','9802','9902']
      ])

      expect(parseConsistFromMotors(['9002M', '9902M'], fleet)).to.deep.equal([
        ['9002','9102','9202','9302','9702','9802','9902']
      ])
    })
  })
})