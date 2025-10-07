export default function parseConsist(locoNumber) {
  if (locoNumber[0] === 'V') {
    const isAbove100 = locoNumber[1] === '2'
    if (isAbove100) return `VL1${locoNumber.slice(-2)}`
    return `VL${locoNumber.slice(-2)}`
  } else if (locoNumber[0] === 'S') return locoNumber.slice(1)
  else return locoNumber
}