import crypto from 'crypto'

export default function getTripID(gtfsTripID) {
  let shasum = crypto.createHash('sha1')
  shasum.update(gtfsTripID)

  return 'RRB-' + shasum.digest('hex').slice(0, 8).toUpperCase()
}