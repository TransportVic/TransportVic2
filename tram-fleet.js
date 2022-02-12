let data = {
  SW5: { ac: false, lf: false },
  W6: { ac: false, lf: false },
  SW6: { ac: false, lf: false },
  PCC: { ac: false, lf: false },
  W7: { ac: false, lf: false },
  W8: { ac: false, lf: false },
  Z1: { ac: false, lf: false },
  Z2: { ac: false, lf: false },
  Z3: { ac: false, lf: false },
  A1: { ac: false, lf: false },
  A2: { ac: false, lf: false },
  B1: { ac: true, lf: false },
  B2: { ac: true, lf: false },
  C: { ac: true, lf: true },
  C2: { ac: true, lf: true },
  D1: { ac: true, lf: true },
  D2: { ac: true, lf: true },
  E1: { ac: true, lf: true },
  E2: { ac: true, lf: true },
}

let cache = {}

function getModel(number) {
  number = parseInt(number)
  if (number <= 100) return 'Z1'
  if (number <= 115) return 'Z2'
  if (number <= 230) return 'Z3'
  if (number <= 258) return 'A1'
  if (number <= 300) return 'A2'

  if ([856, 888, 925, 928, 946, 957, 959, 961, 981, 983, 1010].includes(number)) return 'W8'
  if ([728, 842, 845, 845, 848].includes(number)) return 'SW5'
  if (850 <= number && number <= 969) return 'SW6'
  if (number === 980 || number === 1041) return 'PCC'
  if (970 <= number && number <= 1000) return 'W6'
  if (1001 <= number && number <= 1040) return 'W7'

  if (number === 2001 || number === 2002) return 'B1'
  if (2003 <= number && number <= 2132) return 'B2'

  if (3001 <= number && number <= 3036) return 'C'

  if (3501 <= number && number <= 3538) return 'D1'
  if (5001 <= number && number <= 5021) return 'D2'

  if ([5103, 5106, 5111, 5113, 5123].includes(number)) return 'C2'

  if (6001 <= number && number <= 6050) return 'E1'
  if (6051 <= number && number <= 6100) return 'E2'

  return '?'
}

function getModelFromCache(number) {
  if (cache[number]) return cache[number]
  let model = getModel(number)
  cache[number] = model
  return model
}

module.exports = {
  getModel: getModelFromCache,
  data
}
