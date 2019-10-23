module.exports = stopName => {
  if (stopName === 'Monash University') return 'Monash University Bus Loop'
  if (stopName.includes('Chadstone SC- ')) return 'Chadstone SC/Eastern Access Rd'
  return stopName
}
