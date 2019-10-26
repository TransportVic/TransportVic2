module.exports = function getData(number) {
  if (number <= 100) return 'Z1'
  if (number <= 115) return 'Z2'
  if (number <= 230) return 'Z3'
  if (number <= 258) return 'A1'
  if (number <= 300) return 'A2'

  if ([856, 928, 946, 957, 959, 961, 981, 983, 1010].includes(number)) return 'W8'
  if (850 <= number && number <= 969) return 'SW6'

  if (number === 2001 || number === 2002) return 'B1'
  if (2003 <= number && number <= 2132) return 'B2'

  if (3001 <= number && number <= 3036) return 'C'

  if (3501 <= number && number <= 3538) return 'D1'
  if (5001 <= number && number <= 5021) return 'D2'

  if ([5103, 5106, 5111, 5113, 5123].includes(number)) return 'C2'

  if (6001 <= number && number <= 6050) return 'E1'
  if (6051 <= number && number <= 6090) return 'E2'
  return '?'
}
